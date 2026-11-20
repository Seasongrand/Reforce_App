/**
 * Criar conta sem comprar (área do aluno): o adulto responsável informa nome,
 * e-mail, WhatsApp e, se quiser, o primeiro aluno (só primeiro nome e série),
 * e confirma o e-mail por código. Nunca há duas contas para o mesmo WhatsApp
 * ou e-mail: WhatsApp com conta → o código vai ao e-mail dela e a pessoa entra
 * nela; senão, e-mail com conta → entra nela; senão, cria. A tela não revela
 * qual caso aconteceu.
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import { GRADE_LEVELS } from '../catalog';
import type { Deps } from '../deps';
import { DomainError } from '../errors';
import { maskEmail, normalizeEmail, requestCode, verifyCode } from '../auth/codes';
import { createSession } from '../auth/sessions';
import { normalizePhoneBR, upsertGuardianByPhone, upsertStudent, validTimezone } from './identify';

export interface SignupInput {
  name: string;
  email: string;
  phone: string;
  whatsappOptIn: boolean;
  timezone: string;
  studentFirstName?: string;
  studentGrade?: string;
}

interface Pending {
  name: string;
  phone: string;
  email: string;
  whatsappOptIn: boolean;
  timezone: string;
  student: { firstName: string; grade: string } | null;
}

export async function startGuardianSignup(deps: Deps, input: SignupInput, now: Temporal.Instant) {
  const name = input.name.trim();
  if (name.length < 2) throw new DomainError('invalid', 'informe seu nome');
  const firstName = (input.studentFirstName ?? '').trim().split(/\s+/)[0] ?? '';
  let student: Pending['student'] = null;
  if (firstName) {
    if (firstName.length < 2) throw new DomainError('invalid', 'informe o primeiro nome do aluno');
    if (!GRADE_LEVELS.some((g) => g.slug === input.studentGrade)) throw new DomainError('invalid', 'escolha a série do aluno');
    student = { firstName, grade: input.studentGrade! };
  }
  const phone = normalizePhoneBR(input.phone);
  const email = normalizeEmail(input.email);
  const byPhone = await deps.db.selectFrom('guardians').select('email').where('phone_e164', '=', phone).executeTakeFirst();
  const destination = byPhone?.email ?? email; // WhatsApp com dono: o código vai para o e-mail da conta
  const pending: Pending = { name, phone, email, whatsappOptIn: input.whatsappOptIn, timezone: validTimezone(input.timezone), student };
  const { codeId } = await requestCode(
    deps, { purpose: 'guardian_signup', destination, payload: pending as unknown as Record<string, unknown> }, now,
  );
  return { codeId, sentTo: maskEmail(destination) };
}

export async function finishGuardianSignup(
  deps: Deps,
  input: { codeId: string; code: string },
  now: Temporal.Instant,
): Promise<{ ok: true; token: string; guardianId: string } | { ok: false; reason: 'invalido' | 'expirado' | 'bloqueado' }> {
  const v = await verifyCode(deps, { ...input, purpose: 'guardian_signup' }, now);
  if (!v.ok) return v;
  const p = v.payload as unknown as Pending;
  const guardianId = await deps.db.transaction().execute(async (trx) => {
    const byPhone = await trx.selectFrom('guardians').select('id').where('phone_e164', '=', p.phone).executeTakeFirst();
    // sem conta pelo WhatsApp, o e-mail confirmado agora pode já ter conta (vale a de pedido mais recente)
    const byEmail = byPhone ? undefined : (await sql<{ id: string }>`
      SELECT g.id FROM guardians g LEFT JOIN orders o ON o.guardian_id = g.id
       WHERE lower(g.email) = ${p.email}
       GROUP BY g.id ORDER BY max(o.created_at) DESC NULLS LAST, g.id LIMIT 1`.execute(trx)).rows[0];
    const id = byEmail?.id ?? (await upsertGuardianByPhone(trx, p, now));
    if (p.student) await upsertStudent(trx, id, p.student);
    return id;
  });
  return { ok: true, token: await createSession(deps.db, 'guardian', guardianId, now), guardianId };
}
