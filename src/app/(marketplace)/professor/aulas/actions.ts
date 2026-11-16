'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { joinRoom } from '@/domain/lessons/room';
import { submitCheckin } from '@/domain/lessons/checkin';
import { appDeps, now } from '@/server/app';
import { errorMessage, type ActionState } from '@/server/action-result';
import { requireTeacher } from '@/server/session';

const CHECKIN: Record<string, string> = {
  codigo_errado: 'Código incorreto. Confira com a família.',
  bloqueado: 'Tentativas demais. A equipe vai conferir a aula.',
  fora_do_horario: 'O código só pode ser digitado perto do horário da aula.',
  nao_presencial: 'Esta aula não é presencial.',
};

export async function joinRoomAction(_: unknown, f: FormData): Promise<ActionState> {
  const teacherId = await requireTeacher();
  const bookingId = String(f.get('bookingId') ?? '');
  let url: string;
  try {
    const deps = appDeps();
    const b = await deps.db.selectFrom('bookings').innerJoin('teachers', 'teachers.id', 'bookings.teacher_id')
      .select('teachers.display_name').where('bookings.id', '=', bookingId).where('bookings.teacher_id', '=', teacherId)
      .executeTakeFirst();
    if (!b) return { ok: false, error: 'Aula não encontrada.' };
    url = (await joinRoom(deps, { bookingId, role: 'teacher', displayName: b.display_name }, await now())).joinUrl;
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  redirect(url);
}

export async function checkinAction(_: unknown, f: FormData): Promise<ActionState> {
  const teacherId = await requireTeacher();
  try {
    const r = await submitCheckin(appDeps(), {
      teacherId, bookingId: String(f.get('bookingId') ?? ''), code: String(f.get('code') ?? ''),
    }, await now());
    if (!r.ok) return { ok: false, error: CHECKIN[r.reason] ?? 'Não foi possível registrar.' };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath('/professor/aulas');
  return { ok: true, data: undefined };
}
