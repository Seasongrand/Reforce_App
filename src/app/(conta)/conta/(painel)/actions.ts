'use server';

import { redirect } from 'next/navigation';
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
