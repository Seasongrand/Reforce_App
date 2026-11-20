'use server';

import { redirect } from 'next/navigation';
import { finishGuardianLogin, startGuardianLogin } from '@/domain/auth/guardian';
import { finishGuardianSignup, startGuardianSignup } from '@/domain/guardians/signup';
import { submitReview } from '@/domain/reviews';
import { appDeps, now } from '@/server/app';
import { CODE_ERRORS, errorMessage, type ActionState } from '@/server/action-result';
import { currentSubject, endSession, setSessionCookie } from '@/server/session';

export async function startAction(_: unknown, form: FormData): Promise<ActionState<{ codeId: string; sentTo: string }>> {
  try {
    return { ok: true, data: await startGuardianLogin(appDeps(), String(form.get('email') ?? ''), await now()) };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function finishAction(_: unknown, form: FormData): Promise<ActionState> {
  let r;
  try {
    r = await finishGuardianLogin(appDeps(), { codeId: String(form.get('codeId') ?? ''), code: String(form.get('code') ?? '') }, await now());
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  if (!r.ok) return { ok: false, error: CODE_ERRORS[r.reason] };
  await setSessionCookie('guardian', r.token);
  redirect('/conta');
}

export async function signupStartAction(_: unknown, form: FormData): Promise<ActionState<{ codeId: string; sentTo: string }>> {
  const text = (k: string) => String(form.get(k) ?? '');
  try {
    return {
      ok: true,
      data: await startGuardianSignup(appDeps(), {
        name: text('name'), email: text('email'), phone: text('phone'), whatsappOptIn: form.get('whatsappOptIn') === 'on',
        timezone: text('timezone'), studentFirstName: text('studentFirstName'), studentGrade: text('studentGrade'),
      }, await now()),
    };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function signupFinishAction(_: unknown, form: FormData): Promise<ActionState> {
  let r;
  try {
    r = await finishGuardianSignup(appDeps(), { codeId: String(form.get('codeId') ?? ''), code: String(form.get('code') ?? '') }, await now());
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  if (!r.ok) return { ok: false, error: CODE_ERRORS[r.reason] };
  await setSessionCookie('guardian', r.token);
  redirect('/conta');
}

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
  redirect('/conta?avaliada=1');
}
