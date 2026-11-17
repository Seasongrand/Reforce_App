/**
 * Entrada em "Minha conta" (projeto conta do aluno): a conta é do adulto
 * responsável ("menores sem login"), que entra com o código enviado ao
 * e-mail, sem senha. E-mail sem conta não recebe nada e a tela não denuncia
 * que ele não existe (igual à entrada da equipe).
 */
import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { Deps } from '../deps';
import { maskEmail, normalizeEmail, requestCode, verifyCode } from './codes';
import { createSession } from './sessions';

/** O mesmo e-mail pode estar em mais de um cadastro (o cadastro é por telefone): vale o de pedido mais recente. */
async function guardianByEmail(deps: Deps, email: string): Promise<string | null> {
  const r = await sql<{ id: string }>`
    SELECT g.id FROM guardians g
      LEFT JOIN orders o ON o.guardian_id = g.id
     WHERE lower(g.email) = ${email}
     GROUP BY g.id
     ORDER BY max(o.created_at) DESC NULLS LAST, g.id
     LIMIT 1`.execute(deps.db);
  return r.rows[0]?.id ?? null;
}

export async function startGuardianLogin(deps: Deps, emailInput: string, now: Temporal.Instant) {
  const email = normalizeEmail(emailInput);
  if (!(await guardianByEmail(deps, email))) return { codeId: randomUUID(), sentTo: maskEmail(email) };
  const { codeId } = await requestCode(deps, { purpose: 'guardian_login', destination: email }, now);
  return { codeId, sentTo: maskEmail(email) };
}

export async function finishGuardianLogin(
  deps: Deps,
  input: { codeId: string; code: string },
  now: Temporal.Instant,
): Promise<{ ok: true; token: string; guardianId: string } | { ok: false; reason: 'invalido' | 'expirado' | 'bloqueado' }> {
  const v = await verifyCode(deps, { ...input, purpose: 'guardian_login' }, now);
  if (!v.ok) return v;
  const guardianId = await guardianByEmail(deps, v.destination);
  if (!guardianId) return { ok: false, reason: 'invalido' };
  return { ok: true, token: await createSession(deps.db, 'guardian', guardianId, now), guardianId };
}
