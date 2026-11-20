'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addStudent, removeStudent, updateStudent } from '@/domain/guardians/students';
import { submitReview } from '@/domain/reviews';
import { appDeps, now } from '@/server/app';
import { errorMessage, type ActionState } from '@/server/action-result';
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
