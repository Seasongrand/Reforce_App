/**
 * Meus dados (área do aluno): o responsável muda o nome, liga e desliga os
 * avisos por WhatsApp e troca o e-mail, confirmando o novo por código. Trocar
 * o WhatsApp e excluir a conta ficam com a equipe (política de privacidade).
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { Db } from '@/db/client';
import type { Deps } from '../deps';
import { DomainError } from '../errors';
import { maskEmail, normalizeEmail, requestCode, verifyCode } from '../auth/codes';

export interface GuardianProfile {
  name: string;
  email: string | null;
  phone: string;
  whatsappOptIn: boolean;
}

export async function guardianProfile(db: Db, guardianId: string): Promise<GuardianProfile> {
  const g = await db.selectFrom('guardians').select(['name', 'email', 'phone_e164', 'whatsapp_opt_in_at'])
    .where('id', '=', guardianId).executeTakeFirstOrThrow();
  return { name: g.name, email: g.email, phone: g.phone_e164, whatsappOptIn: g.whatsapp_opt_in_at !== null };
}

/** Nome de 2 a 80 caracteres; avisos ligados guardam a data da primeira autorização, desligados apagam. */
export async function updateGuardianProfile(
  db: Db, guardianId: string, input: { name: string; whatsappOptIn: boolean }, now: Temporal.Instant,
): Promise<void> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) throw new DomainError('invalid', 'informe seu nome (de 2 a 80 letras)');
  await sql`UPDATE guardians
               SET name = ${name},
                   whatsapp_opt_in_at = CASE WHEN ${input.whatsappOptIn}
                                             THEN coalesce(whatsapp_opt_in_at, ${now.toString()}::timestamptz)
                                             ELSE NULL END
             WHERE id = ${guardianId}`.execute(db);
}

async function emailInOtherAccount(db: Db, guardianId: string, email: string): Promise<boolean> {
  const r = await sql<{ id: string }>`
    SELECT id FROM guardians WHERE lower(email) = ${email} AND id <> ${guardianId} LIMIT 1`.execute(db);
  return r.rows.length > 0;
}

export async function startEmailChange(deps: Deps, guardianId: string, newEmail: string, now: Temporal.Instant) {
  const email = normalizeEmail(newEmail);
  const current = await deps.db.selectFrom('guardians').select('email').where('id', '=', guardianId).executeTakeFirstOrThrow();
  if (current.email && current.email.toLowerCase() === email) throw new DomainError('invalid', 'este já é o seu e-mail');
  if (await emailInOtherAccount(deps.db, guardianId, email)) throw new DomainError('conflict', 'este e-mail já está em outra conta');
  const { codeId } = await requestCode(deps, { purpose: 'guardian_email_change', destination: email, payload: { guardianId } }, now);
  return { codeId, sentTo: maskEmail(email) };
}

export async function finishEmailChange(
  deps: Deps,
  guardianId: string,
  input: { codeId: string; code: string },
  now: Temporal.Instant,
): Promise<{ ok: true } | { ok: false; reason: 'invalido' | 'expirado' | 'bloqueado' }> {
  const v = await verifyCode(deps, { ...input, purpose: 'guardian_email_change' }, now);
  if (!v.ok) return v;
  if ((v.payload as { guardianId?: string } | null)?.guardianId !== guardianId) return { ok: false, reason: 'invalido' };
  // outra conta pode ter ficado com este e-mail enquanto o código esperava
  if (await emailInOtherAccount(deps.db, guardianId, v.destination)) throw new DomainError('conflict', 'este e-mail já está em outra conta');
  await deps.db.updateTable('guardians').set({ email: v.destination }).where('id', '=', guardianId).execute();
  return { ok: true };
}
