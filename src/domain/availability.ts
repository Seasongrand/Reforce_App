/**
 * Horários livres ao vivo (§2.3) para a página do professor e a agenda:
 * a função free_slots do banco, nas datas locais do professor, a partir de agora.
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import { instantFromDb } from '@/time/zoned';
import type { Deps } from './deps';

export async function availableSlots(
  deps: Deps,
  input: { teacherId: string; serviceId: string; days: number },
  now: Temporal.Instant,
): Promise<Temporal.Instant[]> {
  const until = now.add({ hours: 24 * input.days }).toString();
  const { rows } = await sql<{ s: string }>`
    WITH t AS (SELECT timezone FROM teachers WHERE id = ${input.teacherId}),
         svc AS (SELECT id FROM services WHERE id = ${input.serviceId} AND teacher_id = ${input.teacherId} AND active),
         d AS (SELECT (${now.toString()}::timestamptz AT TIME ZONE t.timezone)::date AS today FROM t)
    SELECT f AS s
      FROM d, svc, free_slots(${input.teacherId}, svc.id, d.today - 1, d.today + ${input.days}::int + 1, ${now.toString()}::timestamptz) f
     WHERE f < ${until}::timestamptz
     ORDER BY f`.execute(deps.db);
  return rows.map((r) => instantFromDb(r.s));
}
