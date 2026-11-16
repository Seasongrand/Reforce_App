'use server';

import { joinTeacherWaitlist, type Education, type Stage, type WaitlistModality } from '@/domain/waitlist';
import { now, siteDeps } from '@/server/app';
import { errorMessage, type ActionState } from '@/server/action-result';

export async function joinWaitlistAction(_: unknown, f: FormData): Promise<ActionState<{ created: boolean }>> {
  const s = (k: string) => String(f.get(k) ?? '');
  try {
    const r = await joinTeacherWaitlist(siteDeps(), {
      name: s('name'), email: s('email'), phone: s('phone'), city: s('city'), state: s('state'),
      subjectIds: f.getAll('subject').map(Number), stages: f.getAll('stage').map(String) as Stage[],
      modalities: f.getAll('modality').map(String) as WaitlistModality[], education: s('education') as Education,
      notes: s('notes'), consent: f.get('consent') === 'on', website: s('website'),
    }, await now());
    return { ok: true, data: r };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
