/**
 * Livre/ocupado do calendário externo, consultado imediatamente antes da
 * transação de reserva, com limite de tempo, e nunca dentro dela (§2.4).
 * Se o calendário falhar, a reserva segue com o último dado conhecido e o
 * professor é avisado uma vez, na passagem de "funcionando" para "com erro".
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import { withTimeout } from '@/lib/timeout';
import type { Deps } from '../deps';

export async function syncCalendarBusy(
  deps: Deps,
  teacherId: string,
  window: { start: Temporal.Instant; end: Temporal.Instant },
  now: Temporal.Instant,
): Promise<void> {
  const { db, providers, config } = deps;
  const conns = await db
    .selectFrom('calendar_connections')
    .select(['id', 'last_error'])
    .where('teacher_id', '=', teacherId)
    .where('status', '=', 'active')
    .execute();
  for (const conn of conns) {
    try {
      const busy = await withTimeout(
        providers.calendar.freeBusy({ teacherId, connectionId: conn.id }, window),
        config.calendarFreeBusyTimeoutMs,
        'calendário',
      );
      await db.transaction().execute(async (trx) => {
        await sql`DELETE FROM external_busy
                   WHERE teacher_id = ${teacherId} AND calendar_ref = ${conn.id}
                     AND during && tstzrange(${window.start.toString()}::timestamptz, ${window.end.toString()}::timestamptz, '[)')`.execute(trx);
        for (const b of busy) {
          await sql`INSERT INTO external_busy (teacher_id, calendar_ref, provider_event_id, during)
                    VALUES (${teacherId}, ${conn.id}, ${`fb:${b.start.toString()}/${b.end.toString()}`},
                            tstzrange(${b.start.toString()}::timestamptz, ${b.end.toString()}::timestamptz, '[)'))
                    ON CONFLICT (teacher_id, calendar_ref, provider_event_id) DO NOTHING`.execute(trx);
        }
        await sql`UPDATE calendar_connections SET last_synced_at = ${now.toString()}::timestamptz, last_error = NULL
                   WHERE id = ${conn.id}`.execute(trx);
      });
    } catch (err) {
      const message = (err as Error).message;
      await sql`UPDATE calendar_connections SET last_error = ${message} WHERE id = ${conn.id}`.execute(db);
      if (conn.last_error === null) await alertTeacher(deps, teacherId);
    }
  }
}

async function alertTeacher(deps: Deps, teacherId: string) {
  const t = await deps.db.selectFrom('teachers').select(['email', 'display_name']).where('id', '=', teacherId).executeTakeFirst();
  if (!t?.email) return;
  await deps.providers.email.send({
    to: t.email,
    subject: 'Não conseguimos consultar seu calendário',
    text:
      `Olá, ${t.display_name}.\n\nNão conseguimos consultar o seu calendário conectado agora. ` +
      'As reservas continuam usando os compromissos que já conhecíamos, então pode haver conflito com algo marcado há pouco. ' +
      'Confira suas aulas no painel e, se o problema continuar, reconecte o calendário.',
  });
}
