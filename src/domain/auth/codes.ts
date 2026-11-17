/**
 * Códigos de acesso de 6 dígitos, enviados por e-mail (§3.5: e-mail é o
 * padrão; por WhatsApp o código é mensagem de autenticação, com preço próprio).
 * Valem 10 minutos, aceitam 5 tentativas e são limitados a 5 pedidos por hora
 * por destino. No banco fica só um HMAC do código.
 */
import { randomInt, randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import { hmacHex, safeEqualHex } from '@/providers/signing';
import { instantFromDb } from '@/time/zoned';
import type { Deps } from '../deps';
import { DomainError } from '../errors';

export type CodePurpose = 'teacher_login' | 'staff_login' | 'guardian_checkout' | 'guardian_login';
export const CODE_TTL_MIN = 10;
export const CODE_MAX_ATTEMPTS = 5;
export const CODES_PER_HOUR = 5;

export type VerifyResult =
  | { ok: true; destination: string; payload: Record<string, unknown> | null }
  | { ok: false; reason: 'invalido' | 'expirado' | 'bloqueado' };

export function normalizeEmail(input: string): string {
  const e = input.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new DomainError('invalid', 'e-mail inválido');
  return e;
}

/** "maria@exemplo.com" → "m****@exemplo.com" */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  return `${user!.slice(0, 1)}${'*'.repeat(Math.max(1, user!.length - 1))}@${domain}`;
}

const hashCode = (secret: string, codeId: string, code: string) => hmacHex(secret, `otp|${codeId}|${code}`);

export async function requestCode(
  deps: Deps,
  input: { purpose: CodePurpose; destination: string; payload?: Record<string, unknown>; deliver?: boolean },
  now: Temporal.Instant,
): Promise<{ codeId: string }> {
  const recent = await sql<{ n: number }>`
    SELECT count(*)::int AS n FROM auth_codes
     WHERE destination = ${input.destination} AND purpose = ${input.purpose}
       AND created_at > ${now.subtract({ hours: 1 }).toString()}::timestamptz`.execute(deps.db);
  if (recent.rows[0]!.n >= CODES_PER_HOUR) {
    throw new DomainError('conflict', 'muitos códigos pedidos para este e-mail; tente de novo em alguns minutos');
  }
  const codeId = randomUUID();
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await sql`INSERT INTO auth_codes (id, purpose, destination, code_hash, payload, expires_at, created_at)
            VALUES (${codeId}, ${input.purpose}, ${input.destination},
                    ${hashCode(deps.config.sessionSecret, codeId, code)},
                    ${input.payload ? JSON.stringify(input.payload) : null}::jsonb,
                    ${now.add({ minutes: CODE_TTL_MIN }).toString()}::timestamptz, ${now.toString()}::timestamptz)`
    .execute(deps.db);
  if (input.deliver ?? true) {
    await deps.providers.email.send({
      to: input.destination,
      subject: `Seu código de acesso: ${code}`,
      text: `Seu código de acesso é ${code}. Ele vale por ${CODE_TTL_MIN} minutos.\n\n` +
        'Se você não pediu este código, ignore esta mensagem.',
    });
  }
  return { codeId };
}

export async function verifyCode(
  deps: Deps,
  input: { codeId: string; code: string; purpose: CodePurpose },
  now: Temporal.Instant,
): Promise<VerifyResult> {
  if (!/^[0-9a-f-]{36}$/i.test(input.codeId)) return { ok: false, reason: 'invalido' };
  return deps.db.transaction().execute(async (trx) => {
    const row = await trx.selectFrom('auth_codes')
      .select(['destination', 'code_hash', 'payload', 'expires_at', 'attempts', 'consumed_at'])
      .where('id', '=', input.codeId).where('purpose', '=', input.purpose)
      .forUpdate().executeTakeFirst();
    if (!row || row.consumed_at) return { ok: false, reason: 'invalido' } as const;
    if (instantFromDb(row.expires_at).epochMilliseconds < now.epochMilliseconds) return { ok: false, reason: 'expirado' } as const;
    if (row.attempts >= CODE_MAX_ATTEMPTS) return { ok: false, reason: 'bloqueado' } as const;
    const code = input.code.replace(/\D/g, '');
    if (code.length === 6 && safeEqualHex(hashCode(deps.config.sessionSecret, input.codeId, code), row.code_hash)) {
      await sql`UPDATE auth_codes SET consumed_at = ${now.toString()}::timestamptz WHERE id = ${input.codeId}`.execute(trx);
      return { ok: true, destination: row.destination, payload: (row.payload as Record<string, unknown> | null) ?? null } as const;
    }
    await sql`UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ${input.codeId}`.execute(trx);
    return { ok: false, reason: row.attempts + 1 >= CODE_MAX_ATTEMPTS ? 'bloqueado' : 'invalido' } as const;
  });
}
