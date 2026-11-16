'use server';

import { revalidatePath } from 'next/cache';
import {
  addOverride, addRule, connectCalendar, createService, disconnectCalendar, removeOverride, removeRule,
  updateScheduleSettings, updateService, type Modality,
} from '@/domain/teachers/schedule';
import { appDeps, now } from '@/server/app';
import { errorMessage, type ActionState } from '@/server/action-result';
import { requireTeacher } from '@/server/session';

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const n = (f: FormData, k: string) => Number(s(f, k));
const reais = (f: FormData, k: string) => Math.round(Number(s(f, k).replace(/\./g, '').replace(',', '.')) * 100);

async function run(fn: (teacherId: string) => Promise<unknown>, ...paths: string[]): Promise<ActionState> {
  const teacherId = await requireTeacher();
  try {
    await fn(teacherId);
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  for (const p of paths) revalidatePath(p);
  return { ok: true, data: undefined };
}

export async function addRuleAction(_: unknown, f: FormData) {
  return run((t) => addRule(appDeps(), t, {
    weekday: n(f, 'weekday'), start: s(f, 'start'), end: s(f, 'end'),
    validFrom: s(f, 'validFrom') || null, validUntil: s(f, 'validUntil') || null,
  }), '/professor/agenda');
}

export async function removeRuleAction(_: unknown, f: FormData) {
  return run((t) => removeRule(appDeps(), t, s(f, 'id')), '/professor/agenda');
}

export async function addOverrideAction(_: unknown, f: FormData) {
  return run((t) => addOverride(appDeps(), t, {
    date: s(f, 'date'), kind: s(f, 'kind') as 'block' | 'extra', start: s(f, 'start') || null, end: s(f, 'end') || null,
  }), '/professor/agenda');
}

export async function removeOverrideAction(_: unknown, f: FormData) {
  return run((t) => removeOverride(appDeps(), t, s(f, 'id')), '/professor/agenda');
}

export async function saveSettingsAction(_: unknown, f: FormData) {
  return run((t) => updateScheduleSettings(appDeps(), t, {
    minNoticeMin: Math.round(Number(s(f, 'minNoticeHours').replace(',', '.')) * 60),
    horizonDays: n(f, 'horizonDays'),
    slotStepMin: n(f, 'slotStepMin'),
    maxLessonsPerDay: s(f, 'maxLessonsPerDay') ? n(f, 'maxLessonsPerDay') : null,
  }), '/professor/agenda');
}

export async function connectCalendarAction(_: unknown, _f: FormData) {
  return run(async (t) => connectCalendar(appDeps(), t, await now()), '/professor/agenda');
}

export async function disconnectCalendarAction(_: unknown, _f: FormData) {
  return run((t) => disconnectCalendar(appDeps(), t), '/professor/agenda');
}

export async function createServiceAction(_: unknown, f: FormData) {
  return run((t) => createService(appDeps(), t, {
    subjectId: n(f, 'subjectId'), modality: s(f, 'modality') as Modality, durationMin: n(f, 'durationMin'),
    priceCents: reais(f, 'price'),
    bufferBeforeMin: s(f, 'bufferBeforeMin') === '' ? undefined : n(f, 'bufferBeforeMin'),
    bufferAfterMin: s(f, 'bufferAfterMin') === '' ? undefined : n(f, 'bufferAfterMin'),
  }), '/professor/servicos', '/professor/agenda');
}

export async function updateServiceAction(_: unknown, f: FormData) {
  return run((t) => updateService(appDeps(), t, s(f, 'id'), {
    priceCents: s(f, 'price') ? reais(f, 'price') : undefined,
    active: s(f, 'active') ? s(f, 'active') === 'true' : undefined,
  }), '/professor/servicos', '/professor/agenda');
}
