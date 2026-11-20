'use server';

import { revalidatePath } from 'next/cache';
import { DomainError } from '@/domain/errors';
import {
  addOverride, addRule, addRules, connectCalendar, createService, disconnectCalendar, removeOverride, removeRule,
  updateScheduleSettings, updateService, type Modality, type OverrideInput, type RuleInput,
} from '@/domain/teachers/schedule';
import { parseTimeBR } from '@/lib/time-input';
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

/** Como `run`, devolvendo o resultado do domínio para a tela (Agenda: avisos e "Desfazer"). */
async function runData<T>(fn: (teacherId: string) => Promise<T>): Promise<ActionState<T>> {
  const teacherId = await requireTeacher();
  try {
    const data = await fn(teacherId);
    revalidatePath('/professor/agenda');
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Horário digitado (8h, 830, 08:30...) no formato guardado; recusa o resto com o exemplo do formato. */
function typedTime(f: FormData, k: string): string {
  const v = parseTimeBR(s(f, k));
  if (!v) throw new DomainError('invalid', 'Digite o horário assim: 08:00, 8h30 ou 830.');
  return v;
}

/** "Adicionar horários": o mesmo horário nos dias marcados. */
export async function addRulesAction(f: FormData) {
  return runData((t) => addRules(appDeps(), t, {
    weekdays: f.getAll('weekday').map(Number), start: typedTime(f, 'start'), end: typedTime(f, 'end'),
  }));
}

export async function removeRuleAction(id: string) {
  return runData((t) => removeRule(appDeps(), t, String(id)));
}

/** "Desfazer" depois de remover: recria a mesma regra. */
export async function restoreRuleAction(rule: RuleInput) {
  return runData((t) => addRule(appDeps(), t, rule).then(() => undefined));
}

/** "Folga ou horário extra": dia todo bloqueado, período bloqueado ou horário extra. */
export async function addOverrideAction(f: FormData) {
  return runData(async (t) => {
    const what = s(f, 'what');
    if (!['day', 'block', 'extra'].includes(what)) throw new DomainError('invalid', 'escolha o que fazer nesse dia');
    await addOverride(appDeps(), t, {
      date: s(f, 'date'),
      kind: what === 'extra' ? 'extra' : 'block',
      start: what === 'day' ? null : typedTime(f, 'start'),
      end: what === 'day' ? null : typedTime(f, 'end'),
    });
  });
}

export async function removeOverrideAction(id: string) {
  return runData((t) => removeOverride(appDeps(), t, String(id)));
}

export async function restoreOverrideAction(o: OverrideInput) {
  return runData((t) => addOverride(appDeps(), t, o).then(() => undefined));
}

export async function saveSettingsAction(_: unknown, f: FormData) {
  return run((t) => updateScheduleSettings(appDeps(), t, {
    minNoticeMin: n(f, 'minNoticeMin'),
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
