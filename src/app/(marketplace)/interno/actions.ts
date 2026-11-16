'use server';

import { revalidatePath } from 'next/cache';
import { approveTeacher, decideVerification, setTeacherStatus } from '@/domain/staff/review';
import { decideOutcome, type Outcome } from '@/domain/lessons/close';
import { appDeps, now } from '@/server/app';
import { errorMessage, type ActionState } from '@/server/action-result';
import { requireStaff } from '@/server/session';

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

async function run(fn: (staffId: string) => Promise<void>, path: string): Promise<ActionState> {
  const staffId = await requireStaff();
  try {
    await fn(staffId);
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath(path);
  return { ok: true, data: undefined };
}

export async function decideVerificationAction(_: unknown, f: FormData): Promise<ActionState> {
  return run(async (staffId) => decideVerification(appDeps(), {
    verificationId: s(f, 'verificationId'), staffId, decision: s(f, 'decision') as 'approved' | 'rejected',
    note: s(f, 'note'), validUntil: s(f, 'validUntil') || undefined,
  }, await now()), '/interno/verificacoes');
}

export async function approveTeacherAction(_: unknown, f: FormData): Promise<ActionState> {
  return run(async (staffId) => approveTeacher(appDeps(), { teacherId: s(f, 'teacherId'), staffId }, await now()),
    '/interno/verificacoes');
}

export async function setTeacherStatusAction(_: unknown, f: FormData): Promise<ActionState> {
  return run(async (staffId) => setTeacherStatus(appDeps(), {
    teacherId: s(f, 'teacherId'), staffId, status: s(f, 'status') as 'approved' | 'paused' | 'suspended',
  }, await now()), '/interno/verificacoes');
}

export async function decideOutcomeAction(_: unknown, f: FormData): Promise<ActionState> {
  return run(async (staffId) => decideOutcome(appDeps(), {
    bookingId: s(f, 'bookingId'), outcome: s(f, 'outcome') as Outcome, staffId,
  }, await now()), '/interno/aulas');
}
