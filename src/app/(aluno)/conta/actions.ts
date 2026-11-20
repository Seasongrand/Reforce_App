'use server';

import { redirect } from 'next/navigation';
import { finishGuardianLogin, startGuardianLogin } from '@/domain/auth/guardian';
import { finishGuardianSignup, startGuardianSignup } from '@/domain/guardians/signup';
import { appDeps, now } from '@/server/app';
import { CODE_ERRORS, errorMessage, type ActionState } from '@/server/action-result';
import { setSessionCookie } from '@/server/session';
import { safeReturnPath } from '@/lib/return-path';

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
  redirect(safeReturnPath(form.get('voltar')) ?? '/conta');
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
  redirect(safeReturnPath(form.get('voltar')) ?? '/conta');
}
