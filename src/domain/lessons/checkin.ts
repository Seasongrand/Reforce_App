/**
 * Código da aula presencial (§2.6): a família o recebe na confirmação e o
 * informa na chegada; o professor o digita no painel. Derivado por HMAC do id
 * da aula, para ser mostrado de novo sem guardar o código em claro; no banco
 * fica só um hash, também com segredo.
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import { hmacHex, safeEqualHex } from '@/providers/signing';
import { instantFromDb } from '@/time/zoned';
import type { Deps } from '../deps';
import { DomainError } from '../errors';

export function checkinCode(bookingId: string, secret: string): string {
  const n = parseInt(hmacHex(secret, `checkin|${bookingId}`).slice(0, 12), 16) % 1_000_000;
  return String(n).padStart(6, '0');
}

export function checkinHash(bookingId: string, code: string, secret: string): string {
  return hmacHex(secret, `checkin-hash|${bookingId}|${code}`);
}


export const CHECKIN_OPENS_BEFORE_MIN = 30;
export const CHECKIN_CLOSES_AFTER_MIN = 120;
export const CHECKIN_MAX_ATTEMPTS = 5;

export type CheckinResult =
  | { ok: true }
  | { ok: false; reason: 'codigo_errado' | 'bloqueado' | 'fora_do_horario' | 'nao_presencial' };

/** O professor digita no painel o código que a família informou na chegada. */
export async function submitCheckin(
  deps: Deps,
  input: { teacherId: string; bookingId: string; code: string },
  now: Temporal.Instant,
): Promise<CheckinResult> {
  const secret = deps.config.sessionSecret;
  return deps.db.transaction().execute(async (trx) => {
    const { rows } = await sql<{
      starts_at: string; ends_at: string; modality: string; status: string;
      checkin_attempts: number; checkin_code_hash: string | null; checked_in_at: string | null;
    }>`
      SELECT b.starts_at, b.ends_at, b.modality, b.status, ls.checkin_attempts, ls.checkin_code_hash, ls.checked_in_at
        FROM bookings b JOIN lesson_sessions ls ON ls.booking_id = b.id
       WHERE b.id = ${input.bookingId} AND b.teacher_id = ${input.teacherId}
       FOR UPDATE OF ls`.execute(trx);
    const r = rows[0];
    if (!r || r.status !== 'confirmed') throw new DomainError('not_found', 'aula não encontrada');
    if (r.modality === 'online' || !r.checkin_code_hash) return { ok: false, reason: 'nao_presencial' };
    if (r.checked_in_at) return { ok: true };
    const opens = instantFromDb(r.starts_at).subtract({ minutes: CHECKIN_OPENS_BEFORE_MIN });
    const closes = instantFromDb(r.ends_at).add({ minutes: CHECKIN_CLOSES_AFTER_MIN });
    if (now.epochMilliseconds < opens.epochMilliseconds || now.epochMilliseconds > closes.epochMilliseconds) {
      return { ok: false, reason: 'fora_do_horario' };
    }
    if (r.checkin_attempts >= CHECKIN_MAX_ATTEMPTS) return { ok: false, reason: 'bloqueado' };
    const code = input.code.replace(/\D/g, '');
    if (code.length === 6 && safeEqualHex(checkinHash(input.bookingId, code, secret), r.checkin_code_hash)) {
      await sql`UPDATE lesson_sessions SET checked_in_at = ${now.toString()}::timestamptz WHERE booking_id = ${input.bookingId}`
        .execute(trx);
      return { ok: true };
    }
    await sql`UPDATE lesson_sessions SET checkin_attempts = checkin_attempts + 1 WHERE booking_id = ${input.bookingId}`
      .execute(trx);
    return { ok: false, reason: r.checkin_attempts + 1 >= CHECKIN_MAX_ATTEMPTS ? 'bloqueado' : 'codigo_errado' };
  });
}
