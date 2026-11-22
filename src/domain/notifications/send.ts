/**
 * Envia as mensagens vencidas (varredura de minuto em minuto). Cada linha é
 * travada com SKIP LOCKED, então dois processos nunca mandam a mesma
 * mensagem. Confirmação e lembretes de aula que deixou de estar confirmada
 * são cancelados.
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { Deps } from '../deps';
import { TEMPLATES, type Template } from './catalog';
import { loadMessageContext, render } from './templates';

const NEEDS_CONFIRMED = new Set<Template>([
  'confirmacao_responsavel', 'lembrete_24h_responsavel', 'lembrete_1h_responsavel', 'confirmacao_professor',
]);
// o aviso de remarcação sai mesmo se a aula nova for cancelada logo depois: o professor precisa saber da mudança de data

export async function sendDueNotifications(
  deps: Deps,
  now: Temporal.Instant,
  limit = 50,
): Promise<{ sent: number; cancelled: number; failed: number }> {
  return deps.db.transaction().execute(async (trx) => {
    const { rows } = await sql<{ id: string; booking_id: string; channel: 'whatsapp' | 'email'; template: Template; booking_status: string }>`
      SELECT n.id, n.booking_id, n.channel, n.template, b.status AS booking_status
        FROM notifications n JOIN bookings b ON b.id = n.booking_id
       WHERE n.status = 'scheduled' AND n.send_at <= ${now.toString()}::timestamptz
       ORDER BY n.send_at
       LIMIT ${limit}
       FOR UPDATE OF n SKIP LOCKED`.execute(trx);
    const out = { sent: 0, cancelled: 0, failed: 0 };
    for (const n of rows) {
      if (NEEDS_CONFIRMED.has(n.template) && n.booking_status !== 'confirmed') {
        await sql`UPDATE notifications SET status = 'cancelled' WHERE id = ${n.id}`.execute(trx);
        out.cancelled += 1;
        continue;
      }
      try {
        const ctx = await loadMessageContext(deps, n.booking_id, trx);
        const msg = render(n.template, ctx);
        const toTeacher = TEMPLATES[n.template] === 'teacher';
        let providerMessageId: string;
        if (n.channel === 'whatsapp') {
          const to = toTeacher ? ctx.teacher.phone : ctx.guardian.phone;
          if (!to) throw new Error('sem telefone');
          ({ providerMessageId } = await deps.providers.whatsapp.send({ to, ...msg.whatsapp, template: msg.whatsapp.name }));
        } else {
          const to = toTeacher ? ctx.teacher.email : ctx.guardian.email;
          if (!to) throw new Error('sem e-mail');
          ({ providerMessageId } = await deps.providers.email.send({ to, ...msg.email }));
        }
        await sql`UPDATE notifications SET status = 'sent', provider_message_id = ${providerMessageId} WHERE id = ${n.id}`
          .execute(trx);
        out.sent += 1;
      } catch (err) {
        console.error(`[notificações] falha ao enviar ${n.template}/${n.channel}:`, (err as Error).message);
        await sql`UPDATE notifications SET status = 'failed' WHERE id = ${n.id}`.execute(trx);
        out.failed += 1;
      }
    }
    return out;
  });
}
