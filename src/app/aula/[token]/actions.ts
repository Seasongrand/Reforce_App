'use server';

import { redirect } from 'next/navigation';
import { lessonPageView } from '@/domain/lessons/page';
import { joinRoom } from '@/domain/lessons/room';
import { appDeps, now } from '@/server/app';
import { errorMessage, type ActionState } from '@/server/action-result';

export async function joinAsStudentAction(_: unknown, f: FormData): Promise<ActionState> {
  let url: string;
  try {
    const deps = appDeps();
    const at = await now();
    const v = await lessonPageView(deps, String(f.get('token') ?? ''), at);
    if (!v) return { ok: false, error: 'Link inválido ou vencido.' };
    url = (await joinRoom(deps, { bookingId: v.bookingId, role: 'student', displayName: v.studentFirstName }, at)).joinUrl;
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  redirect(url);
}
