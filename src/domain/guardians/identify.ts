/**
 * Conta do responsável, sem senha (§1, família, passo 5): nome, WhatsApp,
 * e-mail confirmado por código, primeiro nome e série do aluno. O aluno é só
 * um perfil, sem login. Um telefone já cadastrado nunca muda de dono: o
 * código vai para o e-mail que já está na conta.
 */
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { sql, type Transaction } from 'kysely';
import type { DB } from '@/db/types';
import type { Temporal } from 'temporal-polyfill';
import { onlyDigits } from '@/providers/geocoding/fake';
import { GRADE_LEVELS } from '../catalog';
import type { Deps } from '../deps';
import { DomainError } from '../errors';
import { maskEmail, normalizeEmail, requestCode, verifyCode } from '../auth/codes';
import { createSession } from '../auth/sessions';

export function normalizePhoneBR(input: string): string {
  const p = parsePhoneNumberFromString(input, 'BR');
  if (!p || !p.isValid()) throw new DomainError('invalid', 'telefone inválido: informe DDD e número');
  return p.number;
}

export interface IdentifyInput {
  name: string;
  phone: string;
  email: string;
  whatsappOptIn: boolean;
  timezone: string;
  studentFirstName: string;
  studentGrade: string;
}

interface Pending {
  name: string;
  phone: string;
  email: string;
  whatsappOptIn: boolean;
  timezone: string;
  student: { firstName: string; grade: string };
  existingGuardianId: string | null;
}

export function validTimezone(tz: string): string {
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: tz });
    return tz;
  } catch {
    return 'America/Sao_Paulo';
  }
}

export async function identifyGuardian(deps: Deps, input: IdentifyInput, now: Temporal.Instant) {
  const name = input.name.trim();
  const firstName = input.studentFirstName.trim().split(/\s+/)[0] ?? '';
  if (name.length < 2) throw new DomainError('invalid', 'informe seu nome');
  if (firstName.length < 2) throw new DomainError('invalid', 'informe o primeiro nome do aluno');
  if (!GRADE_LEVELS.some((g) => g.slug === input.studentGrade)) throw new DomainError('invalid', 'escolha a série do aluno');
  const phone = normalizePhoneBR(input.phone);
  const email = normalizeEmail(input.email);
  const existing = await deps.db.selectFrom('guardians').select(['id', 'email']).where('phone_e164', '=', phone)
    .executeTakeFirst();
  const destination = existing?.email ?? email; // telefone com dono: o código vai para o e-mail da conta
  const pending: Pending = {
    name, phone, email, whatsappOptIn: input.whatsappOptIn, timezone: validTimezone(input.timezone),
    student: { firstName, grade: input.studentGrade }, existingGuardianId: existing?.id ?? null,
  };
  const { codeId } = await requestCode(
    deps, { purpose: 'guardian_checkout', destination, payload: pending as unknown as Record<string, unknown> }, now,
  );
  return { codeId, sentTo: maskEmail(destination) };
}

export async function confirmGuardian(
  deps: Deps,
  input: { codeId: string; code: string },
  now: Temporal.Instant,
): Promise<
  | { ok: true; token: string; guardianId: string; studentId: string }
  | { ok: false; reason: 'invalido' | 'expirado' | 'bloqueado' }
> {
  const v = await verifyCode(deps, { ...input, purpose: 'guardian_checkout' }, now);
  if (!v.ok) return v;
  const p = v.payload as unknown as Pending;
  const { guardianId, studentId } = await deps.db.transaction().execute(async (trx) => {
    const guardianId = await upsertGuardianByPhone(trx, p, now);
    return { guardianId, studentId: await upsertStudent(trx, guardianId, p.student) };
  });
  const token = await createSession(deps.db, 'guardian', guardianId, now);
  return { ok: true, token, guardianId, studentId };
}

/**
 * Cria o responsável pelo WhatsApp ou, se o número já tem conta, atualiza fuso e
 * avisos dela; o e-mail da conta existente nunca muda por aqui.
 */
export async function upsertGuardianByPhone(
  trx: Transaction<DB>,
  p: { name: string; phone: string; email: string; whatsappOptIn: boolean; timezone: string },
  now: Temporal.Instant,
): Promise<string> {
  const optIn = p.whatsappOptIn ? now.toString() : null;
  const g = await sql<{ id: string }>`
    INSERT INTO guardians (name, phone_e164, email, timezone, whatsapp_opt_in_at)
    VALUES (${p.name}, ${p.phone}, ${p.email}, ${p.timezone}, ${optIn}::timestamptz)
    ON CONFLICT (phone_e164) DO UPDATE
       SET timezone = EXCLUDED.timezone,
           email = coalesce(guardians.email, EXCLUDED.email),
           whatsapp_opt_in_at = CASE WHEN ${p.whatsappOptIn}
                                     THEN coalesce(guardians.whatsapp_opt_in_at, EXCLUDED.whatsapp_opt_in_at)
                                     ELSE NULL END
    RETURNING id`.execute(trx);
  return g.rows[0]!.id;
}

/** Aluno do responsável pelo primeiro nome (sem diferenciar maiúsculas): o mesmo nome atualiza a série. */
export async function upsertStudent(
  trx: Transaction<DB>, guardianId: string, student: { firstName: string; grade: string },
): Promise<string> {
  const found = await sql<{ id: string }>`
    SELECT id FROM students WHERE guardian_id = ${guardianId} AND lower(first_name) = lower(${student.firstName})
     LIMIT 1`.execute(trx);
  const id = found.rows[0]?.id;
  if (id) {
    await sql`UPDATE students SET grade = ${student.grade} WHERE id = ${id}`.execute(trx);
    return id;
  }
  const s = await sql<{ id: string }>`
    INSERT INTO students (guardian_id, first_name, grade) VALUES (${guardianId}, ${student.firstName}, ${student.grade})
    RETURNING id`.execute(trx);
  return s.rows[0]!.id;
}

export interface AddressInput {
  cep: string;
  street: string;
  number?: string;
  district?: string;
  city: string;
  state: string;
}

/** Endereço da família para aula na casa do aluno, com o centro do CEP como coordenada. */
export async function saveAddress(deps: Deps, guardianId: string, a: AddressInput): Promise<{ addressId: string }> {
  const cep = onlyDigits(a.cep);
  if (cep.length !== 8) throw new DomainError('invalid', 'CEP inválido');
  if (!a.street.trim() || !a.city.trim()) throw new DomainError('invalid', 'informe rua e cidade');
  const state = a.state.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) throw new DomainError('invalid', 'UF inválida');
  const geo = await deps.providers.geocoder.cepToLatLng(cep);
  const r = await sql<{ id: string }>`
    INSERT INTO addresses (guardian_id, cep, street, number, district, city, state, lat, lng)
    VALUES (${guardianId}, ${cep}, ${a.street.trim()}, ${a.number?.trim() || null}, ${a.district?.trim() || null},
            ${a.city.trim()}, ${state}, ${geo?.lat ?? null}, ${geo?.lng ?? null})
    RETURNING id`.execute(deps.db);
  return { addressId: r.rows[0]!.id };
}

/** Aluno de um responsável já identificado: escolhe um existente ou cria pelo primeiro nome. */
export async function ensureStudent(
  deps: Deps,
  guardianId: string,
  input: { studentId?: string | null; firstName?: string | null; grade?: string | null },
): Promise<string> {
  if (input.studentId) {
    const s = await deps.db.selectFrom('students').select('id').where('id', '=', input.studentId)
      .where('guardian_id', '=', guardianId).executeTakeFirst();
    if (!s) throw new DomainError('invalid', 'aluno não encontrado');
    return s.id;
  }
  const firstName = (input.firstName ?? '').trim().split(/\s+/)[0] ?? '';
  if (firstName.length < 2) throw new DomainError('invalid', 'informe o primeiro nome do aluno');
  if (!GRADE_LEVELS.some((g) => g.slug === input.grade)) throw new DomainError('invalid', 'escolha a série do aluno');
  const r = await sql<{ id: string }>`
    INSERT INTO students (guardian_id, first_name, grade) VALUES (${guardianId}, ${firstName}, ${input.grade}) RETURNING id`
    .execute(deps.db);
  return r.rows[0]!.id;
}
