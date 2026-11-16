'use server';

import { redirect } from 'next/navigation';
import { finishStaffLogin, startStaffLogin } from '@/domain/auth/staff';
import { appDeps, now } from '@/server/app';
import { CODE_ERRORS, errorMessage, type ActionState } from '@/server/action-result';
import { endSession, setSessionCookie } from '@/server/session';

export async function startAction(_: unknown, form: FormData): Promise<ActionState<{ codeId: string; sentTo: string }>> {
  try {
    return { ok: true, data: await startStaffLogin(appDeps(), String(form.get('email') ?? ''), await now()) };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function finishAction(_: unknown, form: FormData): Promise<ActionState> {
  let r;
  try {
    r = await finishStaffLogin(
      appDeps(),
      { codeId: String(form.get('codeId') ?? ''), code: String(form.get('code') ?? '') },
      await now(),
    );
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  if (!r.ok) return { ok: false, error: CODE_ERRORS[r.reason] };
  await setSessionCookie('staff', r.token);
  redirect('/interno');
}

export async function logoutAction(): Promise<void> {
  await endSession('staff');
  redirect('/interno/entrar');
}
