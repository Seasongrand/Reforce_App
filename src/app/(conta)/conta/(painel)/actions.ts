'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { finishEmailChange, startEmailChange, updateGuardianProfile } from '@/domain/guardians/profile';
import { sendMessage } from '@/domain/messages';
import { cancelByFamily, rescheduleByFamily, type RescheduleReason } from '@/domain/lessons/change';
import { endWeeklySeries, startWeeklySeries } from '@/domain/booking/weekly';
import { Temporal } from 'temporal-polyfill';
import { acquisitionFor, originCookieName } from '@/domain/family-origin';
import { cookies } from 'next/headers';
import { addStudent, removeStudent, updateStudent } from '@/domain/guardians/students';
import { submitReview } from '@/domain/reviews';
import { appDeps, now } from '@/server/app';
import { CODE_ERRORS, errorMessage, type ActionState } from '@/server/action-result';
import { currentSubject, endSession } from '@/server/session';

export async function logoutAction(): Promise<void> {
  await endSession('guardian');
  redirect('/conta/entrar');
}

export async function reviewAction(_: unknown, form: FormData): Promise<ActionState> {
  const guardianId = await currentSubject('guardian');
  if (!guardianId) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  try {
    await submitReview(appDeps(), {
      guardianId,
      bookingId: String(form.get('bookingId') ?? ''),
      rating: Number(form.get('rating') ?? 0),
      comment: String(form.get('comment') ?? ''),
    }, await now());
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  redirect('/conta/aulas?aba=anteriores&avaliada=1');
}

/** Ação de Minha conta: só com a sessão do responsável; erros de regra viram mensagem na tela. */
async function asGuardian(run: (guardianId: string) => Promise<void>, path: string): Promise<ActionState> {
  const guardianId = await currentSubject('guardian');
  if (!guardianId) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  try {
    await run(guardianId);
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath(path);
  return { ok: true, data: undefined };
}

const field = (form: FormData, k: string) => String(form.get(k) ?? '');

export async function addStudentAction(_: unknown, form: FormData): Promise<ActionState> {
  return asGuardian(async (g) => {
    await addStudent(appDeps().db, g, { firstName: field(form, 'firstName'), grade: field(form, 'grade') });
  }, '/conta/alunos');
}

export async function updateStudentAction(_: unknown, form: FormData): Promise<ActionState> {
  return asGuardian((g) => updateStudent(appDeps().db, g, field(form, 'studentId'), {
    firstName: field(form, 'firstName'), grade: field(form, 'grade'),
  }), '/conta/alunos');
}

export async function removeStudentAction(_: unknown, form: FormData): Promise<ActionState> {
  return asGuardian((g) => removeStudent(appDeps().db, g, field(form, 'studentId')), '/conta/alunos');
}

export async function updateProfileAction(_: unknown, form: FormData): Promise<ActionState> {
  const r = await asGuardian(async (g) => updateGuardianProfile(appDeps().db, g, {
    name: field(form, 'name'), whatsappOptIn: form.get('whatsappOptIn') === 'on',
  }, await now()), '/conta/dados');
  if (r?.ok) revalidatePath('/conta', 'layout'); // o nome aparece no topo e no "Olá"
  return r;
}

export async function emailStartAction(_: unknown, form: FormData): Promise<ActionState<{ codeId: string; sentTo: string }>> {
  const guardianId = await currentSubject('guardian');
  if (!guardianId) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  try {
    return { ok: true, data: await startEmailChange(appDeps(), guardianId, field(form, 'email'), await now()) };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function emailFinishAction(_: unknown, form: FormData): Promise<ActionState> {
  const guardianId = await currentSubject('guardian');
  if (!guardianId) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  try {
    const r = await finishEmailChange(appDeps(), guardianId, { codeId: field(form, 'codeId'), code: field(form, 'code') }, await now());
    if (!r.ok) return { ok: false, error: CODE_ERRORS[r.reason] };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath('/conta/dados');
  return { ok: true, data: undefined };
}

const UUID = /^[0-9a-f-]{36}$/i;

export async function sendToTeacherAction(_: unknown, form: FormData): Promise<ActionState<{ hidden: boolean }>> {
  const guardianId = await currentSubject('guardian');
  if (!guardianId) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  const teacherId = field(form, 'teacherId');
  if (!UUID.test(teacherId)) return { ok: false, error: 'professor não encontrado' };
  try {
    const deps = appDeps();
    const t = await deps.db.selectFrom('teachers').select('slug').where('id', '=', teacherId).executeTakeFirst();
    const acquisition = acquisitionFor(t ? (await cookies()).get(originCookieName(t.slug))?.value : undefined);
    const r = await sendMessage(deps, { teacherId, guardianId, from: 'guardian', body: field(form, 'body'), acquisition }, await now());
    revalidatePath('/conta', 'layout');
    return { ok: true, data: r };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

const RESCHEDULE: Record<RescheduleReason, string> = {
  ocupado: 'Esse horário acabou de ser reservado. Escolha outro.',
  indisponivel: 'Esse horário não está mais disponível. Escolha outro.',
  antecedencia: 'Esse horário está perto demais para o professor se preparar. Escolha outro.',
  limite_diario: 'O professor já tem o máximo de aulas nesse dia. Escolha outro dia.',
};

export async function rescheduleAction(_: unknown, form: FormData): Promise<ActionState> {
  const guardianId = await currentSubject('guardian');
  if (!guardianId) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  let startsAt: Temporal.Instant;
  try {
    startsAt = Temporal.Instant.from(field(form, 'startsAt'));
  } catch {
    return { ok: false, error: 'Escolha o novo horário.' };
  }
  try {
    const r = await rescheduleByFamily(appDeps(), { guardianId, bookingId: field(form, 'bookingId'), startsAt }, await now());
    if (!r.ok) return { ok: false, error: RESCHEDULE[r.reason] };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath('/conta', 'layout');
  redirect('/conta/aulas?remarcada=1');
}

export async function cancelLessonAction(_: unknown, form: FormData): Promise<ActionState> {
  const guardianId = await currentSubject('guardian');
  if (!guardianId) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  if (form.get('confirm') !== 'on') return { ok: false, error: 'Marque a confirmação para cancelar.' };
  try {
    await cancelByFamily(appDeps(), { guardianId, bookingId: field(form, 'bookingId') }, await now());
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath('/conta', 'layout');
  redirect('/conta/aulas?cancelada=1');
}

export async function startWeeklyAction(_: unknown, form: FormData): Promise<ActionState> {
  const guardianId = await currentSubject('guardian');
  if (!guardianId) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  try {
    await startWeeklySeries(appDeps(), { guardianId, bookingId: field(form, 'bookingId') }, await now());
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath('/conta', 'layout');
  redirect('/conta/aulas?fixo=1');
}

export async function endWeeklyAction(_: unknown, form: FormData): Promise<ActionState> {
  const guardianId = await currentSubject('guardian');
  if (!guardianId) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  if (form.get('confirm') !== 'on') return { ok: false, error: 'Marque a confirmação para encerrar.' };
  try {
    await endWeeklySeries(appDeps(), { guardianId, seriesId: field(form, 'seriesId') }, await now());
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath('/conta', 'layout');
  redirect('/conta/aulas?fixo-encerrado=1');
}
