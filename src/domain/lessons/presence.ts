/**
 * Registro de presença vindo do provedor de vídeo (§2.6). Cada evento entra
 * uma vez em webhook_events; a primeira entrada de cada papel fica guardada e
 * o tempo na sala soma a cada saída.
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { HeaderBag } from '@/providers/signing';
import { instantFromDb } from '@/time/zoned';
import type { Deps } from '../deps';

export async function handleVideoWebhook(
  deps: Deps,
  headers: HeaderBag,
  rawBody: string,
  _now: Temporal.Instant,
): Promise<{ processed: number }> {
  const events = deps.providers.video.parsePresenceWebhook(headers, rawBody); // lança se a assinatura não bater
  const key = `video:${deps.providers.video.name}`;
  let processed = 0;
  for (const ev of events) {
    await deps.db.transaction().execute(async (trx) => {
      const at = ev.at.toString();
      const ins = await sql<{ id: string }>`
        INSERT INTO webhook_events (provider, provider_event_id, payload)
        VALUES (${key}, ${ev.eventId},
                ${JSON.stringify({ room: ev.roomName, role: ev.role, kind: ev.kind, at })}::jsonb)
        ON CONFLICT (provider, provider_event_id) DO NOTHING RETURNING id::text`.execute(trx);
      const id = ins.rows[0]?.id;
      if (!id) return; // repetido
      if (ev.role !== 'observer') {
        if (ev.kind === 'joined') {
          if (ev.role === 'teacher') {
            await sql`UPDATE lesson_sessions SET teacher_joined_at = coalesce(teacher_joined_at, ${at}::timestamptz)
                       WHERE video_room = ${ev.roomName}`.execute(trx);
          } else {
            await sql`UPDATE lesson_sessions SET student_joined_at = coalesce(student_joined_at, ${at}::timestamptz)
                       WHERE video_room = ${ev.roomName}`.execute(trx);
          }
        } else {
          const last = await sql<{ at: string }>`
            SELECT (payload->>'at')::timestamptz AS at FROM webhook_events
             WHERE provider = ${key} AND payload->>'room' = ${ev.roomName} AND payload->>'role' = ${ev.role}
               AND payload->>'kind' = 'joined' AND (payload->>'at')::timestamptz <= ${at}::timestamptz
             ORDER BY (payload->>'at')::timestamptz DESC LIMIT 1`.execute(trx);
          if (last.rows[0]) {
            const secs = Math.max(0, Math.round((ev.at.epochMilliseconds - instantFromDb(last.rows[0].at).epochMilliseconds) / 1000));
            if (ev.role === 'teacher') {
              await sql`UPDATE lesson_sessions SET teacher_seconds = teacher_seconds + ${secs} WHERE video_room = ${ev.roomName}`
                .execute(trx);
            } else {
              await sql`UPDATE lesson_sessions SET student_seconds = student_seconds + ${secs} WHERE video_room = ${ev.roomName}`
                .execute(trx);
            }
          }
        }
      }
      await sql`UPDATE webhook_events SET processed_at = now() WHERE id = ${id}`.execute(trx);
      processed += 1;
    });
  }
  return { processed };
}
