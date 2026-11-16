/**
 * Entrada da equipe no painel interno. Só e-mails cadastrados em staff_users
 * recebem código; para os demais a resposta é a mesma, sem envio, para não
 * revelar quem tem acesso.
 */
import { randomUUID } from 'node:crypto';
import type { Temporal } from 'temporal-polyfill';
import type { Deps } from '../deps';
import { maskEmail, normalizeEmail, requestCode, verifyCode } from './codes';
import { createSession } from './sessions';

export async function startStaffLogin(deps: Deps, emailInput: string, now: Temporal.Instant) {
  const email = normalizeEmail(emailInput);
  const staff = await deps.db.selectFrom('staff_users').select('id').where('email', '=', email).executeTakeFirst();
  if (!staff) return { codeId: randomUUID(), sentTo: maskEmail(email) };
  const { codeId } = await requestCode(deps, { purpose: 'staff_login', destination: email }, now);
  return { codeId, sentTo: maskEmail(email) };
}

export async function finishStaffLogin(
  deps: Deps,
  input: { codeId: string; code: string },
  now: Temporal.Instant,
): Promise<{ ok: true; token: string; staffId: string } | { ok: false; reason: 'invalido' | 'expirado' | 'bloqueado' }> {
  const v = await verifyCode(deps, { ...input, purpose: 'staff_login' }, now);
  if (!v.ok) return v;
  const staff = await deps.db.selectFrom('staff_users').select('id').where('email', '=', v.destination).executeTakeFirst();
  if (!staff) return { ok: false, reason: 'invalido' };
  return { ok: true, token: await createSession(deps.db, 'staff', staff.id, now), staffId: staff.id };
}
