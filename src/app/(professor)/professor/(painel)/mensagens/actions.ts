'use server';

import { revalidatePath } from 'next/cache';
import { sendMessage } from '@/domain/messages';
import { appDeps, now } from '@/server/app';
import { errorMessage, type ActionState } from '@/server/action-result';
import { currentSubject } from '@/server/session';

const UUID = /^[0-9a-f-]{36}$/i;

/** O professor responde numa conversa que já existe (nunca começa uma). */
export async function sendToGuardianAction(_: unknown, form: FormData): Promise<ActionState<{ hidden: boolean }>> {
  const teacherId = await currentSubject('teacher');
  if (!teacherId) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  const guardianId = String(form.get('guardianId') ?? '');
  if (!UUID.test(guardianId)) return { ok: false, error: 'conversa não encontrada' };
  try {
    const r = await sendMessage(appDeps(), { teacherId, guardianId, from: 'teacher', body: String(form.get('body') ?? '') }, await now());
    revalidatePath('/professor', 'layout');
    return { ok: true, data: r };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
