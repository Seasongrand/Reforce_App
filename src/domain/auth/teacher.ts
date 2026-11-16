/**
 * Entrada do professor por código no e-mail. O primeiro acesso cria o
 * cadastro em rascunho; o perfil é preenchido em seguida (§1, professor, passo 1).
 */
import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { Deps } from '../deps';
import { maskEmail, normalizeEmail, requestCode, verifyCode } from './codes';
import { createSession } from './sessions';

export async function startTeacherLogin(deps: Deps, emailInput: string, now: Temporal.Instant) {
  const email = normalizeEmail(emailInput);
  const { codeId } = await requestCode(deps, { purpose: 'teacher_login', destination: email }, now);
  return { codeId, sentTo: maskEmail(email) };
}

export async function finishTeacherLogin(
  deps: Deps,
  input: { codeId: string; code: string },
  now: Temporal.Instant,
): Promise<{ ok: true; token: string; teacherId: string; isNew: boolean } | { ok: false; reason: 'invalido' | 'expirado' | 'bloqueado' }> {
  const v = await verifyCode(deps, { ...input, purpose: 'teacher_login' }, now);
  if (!v.ok) return v;
  const existing = await deps.db.selectFrom('teachers').select('id').where('email', '=', v.destination).executeTakeFirst();
  let teacherId = existing?.id;
  if (!teacherId) {
    const r = await sql<{ id: string }>`
      INSERT INTO teachers (slug, display_name, email)
      VALUES (${`professor-${randomUUID().slice(0, 8)}`}, ${v.destination.split('@')[0]!}, ${v.destination})
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING id`.execute(deps.db);
    teacherId = r.rows[0]!.id;
  }
  const token = await createSession(deps.db, 'teacher', teacherId, now);
  return { ok: true, token, teacherId, isNew: !existing };
}
