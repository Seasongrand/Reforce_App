'use server';

import { redirect } from 'next/navigation';
import { Temporal } from 'temporal-polyfill';
import { holdSlots, type HoldReason } from '@/domain/booking/hold';
import { confirmGuardian, ensureStudent, identifyGuardian, saveAddress } from '@/domain/guardians/identify';
import { DomainError } from '@/domain/errors';
import { appDeps, now } from '@/server/app';
import { CODE_ERRORS, errorMessage } from '@/server/action-result';
import { currentSubject, setSessionCookie } from '@/server/session';

export type BookingState =
  | null
  | { ok: true; data: { codeId: string; sentTo: string } }
  | { ok: false; error: string; alternatives?: string[] };

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

const REASONS: Record<HoldReason, string> = {
  ocupado: 'Esse horário acabou de ser reservado. Estes são os horários livres mais próximos:',
  indisponivel: 'Esse horário não está mais disponível. Estes são os horários livres mais próximos:',
  antecedencia: 'Esse horário está perto demais: o professor pede mais antecedência.',
  limite_diario: 'O professor já atingiu o limite de aulas nesse dia.',
  professor_indisponivel: 'A agenda deste professor está indisponível no momento.',
  fora_do_raio: 'Seu endereço está fora da área de atendimento do professor para aula em casa.',
};

export async function identifyAction(_: unknown, f: FormData): Promise<BookingState> {
  try {
    const r = await identifyGuardian(appDeps(), {
      name: s(f, 'name'), phone: s(f, 'phone'), email: s(f, 'email'), whatsappOptIn: f.get('whatsappOptIn') === 'on',
      timezone: s(f, 'timezone'), studentFirstName: s(f, 'studentFirstName'), studentGrade: s(f, 'studentGrade'),
    }, await now());
    return { ok: true, data: r };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

async function hold(guardianId: string, studentId: string, f: FormData): Promise<BookingState | string> {
  const deps = appDeps();
  const svc = await deps.db.selectFrom('services').select(['modality', 'teacher_id']).where('id', '=', s(f, 'serviceId'))
    .executeTakeFirst();
  if (!svc) throw new DomainError('not_found', 'serviço não encontrado');
  let addressId: string | null = null;
  if (svc.modality === 'at_student') {
    addressId = s(f, 'addressId') || (await saveAddress(deps, guardianId, {
      cep: s(f, 'cep'), street: s(f, 'street'), number: s(f, 'number'), district: s(f, 'district'),
      city: s(f, 'city'), state: s(f, 'state'),
    })).addressId;
  }
  let startsAt: Temporal.Instant;
  try {
    startsAt = Temporal.Instant.from(s(f, 'startsAt'));
  } catch {
    throw new DomainError('invalid', 'horário inválido');
  }
  const r = await holdSlots(deps, {
    teacherId: svc.teacher_id, serviceId: s(f, 'serviceId'), guardianId, studentId, addressId,
    startsAt: [startsAt], idempotencyKey: s(f, 'idempotencyKey'),
  }, await now());
  if (r.ok) return `/pedido/${r.orderId}`;
  return { ok: false, error: REASONS[r.reason], alternatives: r.alternatives.map((a) => a.toString()) };
}

export async function confirmAndHoldAction(_: unknown, f: FormData): Promise<BookingState> {
  let next: BookingState | string;
  try {
    const c = await confirmGuardian(appDeps(), { codeId: s(f, 'codeId'), code: s(f, 'code') }, await now());
    if (!c.ok) return { ok: false, error: CODE_ERRORS[c.reason] };
    await setSessionCookie('guardian', c.token);
    next = await hold(c.guardianId, c.studentId, f);
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  if (typeof next === 'string') redirect(next);
  return next;
}

export async function holdAsGuardianAction(_: unknown, f: FormData): Promise<BookingState> {
  const guardianId = await currentSubject('guardian');
  if (!guardianId) return { ok: false, error: 'Sua sessão expirou. Recarregue a página e identifique-se de novo.' };
  let next: BookingState | string;
  try {
    const studentId = await ensureStudent(appDeps(), guardianId, {
      studentId: s(f, 'studentId') || null, firstName: s(f, 'studentFirstName'), grade: s(f, 'studentGrade'),
    });
    next = await hold(guardianId, studentId, f);
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  if (typeof next === 'string') redirect(next);
  return next;
}
