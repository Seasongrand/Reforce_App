/**
 * Agenda do professor (§1, professor, passo 5): regras semanais em hora
 * local, exceções por data, antecedência, janela, grade, limite diário e
 * serviços por modalidade. Disponibilidade não é armazenada: muda na hora.
 */
import { sql } from 'kysely';
import { Temporal } from 'temporal-polyfill';
import { formatBRL } from '@/lib/money';
import { enqueue } from '@/worker/enqueue';
import { SUBJECTS } from '../catalog';
import type { Deps } from '../deps';
import { DomainError } from '../errors';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const refresh = (deps: Deps, teacherId: string) =>
  enqueue(deps.db, 'search.refresh_teacher', { teacherId }, { jobKey: `refresh:${teacherId}` });

function time(v: string | undefined, what: string): string {
  if (!v || !TIME_RE.test(v)) throw new DomainError('invalid', `${what}: use o formato HH:MM`);
  return v;
}

function date(v: string | undefined, what: string): string {
  try {
    return Temporal.PlainDate.from(v ?? '').toString();
  } catch {
    throw new DomainError('invalid', `${what}: data inválida`);
  }
}

export interface RuleInput {
  weekday: number; // ISO: 1 = segunda
  start: string;
  end: string;
  validFrom?: string | null;
  validUntil?: string | null;
}

export async function addRule(deps: Deps, teacherId: string, r: RuleInput): Promise<string> {
  if (!Number.isInteger(r.weekday) || r.weekday < 1 || r.weekday > 7) throw new DomainError('invalid', 'dia da semana inválido');
  const start = time(r.start, 'início');
  const end = time(r.end, 'fim');
  if (end <= start) throw new DomainError('invalid', 'o horário precisa ter fim depois do início');
  const from = r.validFrom ? date(r.validFrom, 'vigência') : null;
  const until = r.validUntil ? date(r.validUntil, 'vigência') : null;
  if (from && until && until < from) throw new DomainError('invalid', 'a vigência termina antes de começar');
  const overlap = await sql<{ n: number }>`
    SELECT count(*)::int AS n FROM availability_rules
     WHERE teacher_id = ${teacherId} AND weekday = ${r.weekday}
       AND start_local < ${end}::time AND end_local > ${start}::time
       AND daterange(valid_from, valid_until, '[]') && daterange(${from}::date, ${until}::date, '[]')`.execute(deps.db);
  if (overlap.rows[0]!.n > 0) throw new DomainError('conflict', 'este horário se sobrepõe a outro do mesmo dia');
  const ins = await sql<{ id: string }>`
    INSERT INTO availability_rules (teacher_id, weekday, start_local, end_local, valid_from, valid_until)
    VALUES (${teacherId}, ${r.weekday}, ${start}::time, ${end}::time, ${from}::date, ${until}::date) RETURNING id`
    .execute(deps.db);
  await refresh(deps, teacherId);
  return ins.rows[0]!.id;
}

export async function removeRule(deps: Deps, teacherId: string, ruleId: string): Promise<void> {
  await sql`DELETE FROM availability_rules WHERE id = ${ruleId} AND teacher_id = ${teacherId}`.execute(deps.db);
  await refresh(deps, teacherId);
}

export interface OverrideInput {
  date: string;
  kind: 'block' | 'extra';
  start?: string | null;
  end?: string | null;
}

export async function addOverride(deps: Deps, teacherId: string, o: OverrideInput): Promise<string> {
  const day = date(o.date, 'data');
  if (o.kind !== 'block' && o.kind !== 'extra') throw new DomainError('invalid', 'tipo de exceção inválido');
  let start: string | null = null;
  let end: string | null = null;
  if (o.kind === 'extra' || o.start || o.end) {
    if (!o.start || !o.end) throw new DomainError('invalid', 'informe início e fim do horário');
    start = time(o.start, 'início');
    end = time(o.end, 'fim');
    if (end <= start) throw new DomainError('invalid', 'o horário precisa ter fim depois do início');
  }
  const ins = await sql<{ id: string }>`
    INSERT INTO availability_overrides (teacher_id, on_date, kind, start_local, end_local)
    VALUES (${teacherId}, ${day}::date, ${o.kind}, ${start}::time, ${end}::time) RETURNING id`.execute(deps.db);
  await refresh(deps, teacherId);
  return ins.rows[0]!.id;
}

export async function removeOverride(deps: Deps, teacherId: string, overrideId: string): Promise<void> {
  await sql`DELETE FROM availability_overrides WHERE id = ${overrideId} AND teacher_id = ${teacherId}`.execute(deps.db);
  await refresh(deps, teacherId);
}

export const SLOT_STEPS = [10, 15, 20, 30, 60] as const;

export async function updateScheduleSettings(
  deps: Deps,
  teacherId: string,
  s: { minNoticeMin: number; horizonDays: number; slotStepMin: number; maxLessonsPerDay: number | null },
): Promise<void> {
  if (!Number.isInteger(s.minNoticeMin) || s.minNoticeMin < 0 || s.minNoticeMin > 7 * 24 * 60) {
    throw new DomainError('invalid', 'antecedência mínima entre 0 e 7 dias');
  }
  if (!Number.isInteger(s.horizonDays) || s.horizonDays < 1 || s.horizonDays > 180) {
    throw new DomainError('invalid', 'janela de agendamento entre 1 e 180 dias');
  }
  if (!(SLOT_STEPS as readonly number[]).includes(s.slotStepMin)) throw new DomainError('invalid', 'grade de horários inválida');
  if (s.maxLessonsPerDay !== null && (!Number.isInteger(s.maxLessonsPerDay) || s.maxLessonsPerDay < 1 || s.maxLessonsPerDay > 24)) {
    throw new DomainError('invalid', 'limite diário entre 1 e 24 aulas');
  }
  await sql`UPDATE teachers SET min_notice_min = ${s.minNoticeMin}, horizon_days = ${s.horizonDays},
                                slot_step_min = ${s.slotStepMin}, max_lessons_per_day = ${s.maxLessonsPerDay}
             WHERE id = ${teacherId}`.execute(deps.db);
  await refresh(deps, teacherId);
}

export type Modality = 'online' | 'at_teacher' | 'at_student';
export const DEFAULT_TRAVEL_BUFFER_MIN = 30;

export interface ServiceInput {
  subjectId: number;
  modality: Modality;
  durationMin: number;
  priceCents: number;
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
}

function checkNumbers(deps: Deps, s: { durationMin?: number; priceCents?: number; bufferBeforeMin?: number; bufferAfterMin?: number }) {
  if (s.durationMin !== undefined && (!Number.isInteger(s.durationMin) || s.durationMin < 30 || s.durationMin > 240 || s.durationMin % 5)) {
    throw new DomainError('invalid', 'duração entre 30 e 240 minutos, em múltiplos de 5');
  }
  if (s.priceCents !== undefined) {
    const floor = deps.config.priceFloorCents;
    if (!Number.isInteger(s.priceCents) || s.priceCents <= 0) throw new DomainError('invalid', 'informe o preço da aula');
    if (s.priceCents < floor) throw new DomainError('invalid', `o preço mínimo da plataforma é ${formatBRL(floor)}`);
  }
  for (const b of [s.bufferBeforeMin, s.bufferAfterMin]) {
    if (b !== undefined && (!Number.isInteger(b) || b < 0 || b > 180)) {
      throw new DomainError('invalid', 'intervalo entre 0 e 180 minutos');
    }
  }
}

export async function createService(deps: Deps, teacherId: string, s: ServiceInput): Promise<string> {
  if (!['online', 'at_teacher', 'at_student'].includes(s.modality)) throw new DomainError('invalid', 'modalidade inválida');
  const inPerson = s.modality !== 'online';
  const input = {
    ...s,
    bufferBeforeMin: s.bufferBeforeMin ?? (inPerson ? DEFAULT_TRAVEL_BUFFER_MIN : 0),
    bufferAfterMin: s.bufferAfterMin ?? (inPerson ? DEFAULT_TRAVEL_BUFFER_MIN : 0),
  };
  checkNumbers(deps, input);
  const teaches = await sql<{ n: number }>`
    SELECT count(*)::int AS n FROM teacher_subjects WHERE teacher_id = ${teacherId} AND subject_id = ${s.subjectId}`
    .execute(deps.db);
  const subject = SUBJECTS.find((x) => x.id === s.subjectId);
  if (!subject || teaches.rows[0]!.n === 0) throw new DomainError('invalid', 'escolha uma disciplina que está no seu perfil');
  const t = await deps.db.selectFrom('teachers').select(['teaching_address', 'base_cep', 'travel_radius_km'])
    .where('id', '=', teacherId).executeTakeFirstOrThrow();
  if (s.modality === 'at_teacher' && !t.teaching_address) {
    throw new DomainError('invalid', 'informe no perfil o endereço onde você dá aula');
  }
  if (s.modality === 'at_student' && (!t.base_cep || !t.travel_radius_km)) {
    throw new DomainError('invalid', 'informe no perfil o CEP e o raio de atendimento');
  }
  const ins = await sql<{ id: string }>`
    INSERT INTO services (teacher_id, subject, subject_id, duration_min, price_cents, modality, buffer_before_min, buffer_after_min)
    VALUES (${teacherId}, ${subject.slug}, ${subject.id}, ${input.durationMin}, ${input.priceCents}, ${input.modality},
            ${input.bufferBeforeMin}, ${input.bufferAfterMin})
    RETURNING id`.execute(deps.db);
  await refresh(deps, teacherId);
  return ins.rows[0]!.id;
}

/** Preço, duração e intervalos novos valem para as próximas reservas; pedidos já feitos guardam os seus. */
export async function updateService(
  deps: Deps,
  teacherId: string,
  serviceId: string,
  s: Partial<Pick<ServiceInput, 'durationMin' | 'priceCents' | 'bufferBeforeMin' | 'bufferAfterMin'>> & { active?: boolean },
): Promise<void> {
  checkNumbers(deps, s);
  const r = await sql`UPDATE services SET
                        duration_min = coalesce(${s.durationMin ?? null}::int, duration_min),
                        price_cents = coalesce(${s.priceCents ?? null}::int, price_cents),
                        buffer_before_min = coalesce(${s.bufferBeforeMin ?? null}::int, buffer_before_min),
                        buffer_after_min = coalesce(${s.bufferAfterMin ?? null}::int, buffer_after_min),
                        active = coalesce(${s.active ?? null}::boolean, active)
                      WHERE id = ${serviceId} AND teacher_id = ${teacherId}`.execute(deps.db);
  if (Number(r.numAffectedRows ?? 0) === 0) throw new DomainError('not_found', 'serviço não encontrado');
  await refresh(deps, teacherId);
}

/**
 * Conecta o calendário externo. Com o adaptador falso, não há OAuth; o
 * adaptador do Google (escopos calendar.freebusy e calendar.app.created, §3.3)
 * entra quando as credenciais chegarem.
 */
export async function connectCalendar(deps: Deps, teacherId: string, now: Temporal.Instant): Promise<void> {
  await sql`INSERT INTO calendar_connections (teacher_id, provider, lessons_calendar_id, status, last_synced_at)
            VALUES (${teacherId}, ${deps.providers.calendar.name}, 'Aulas', 'active', ${now.toString()}::timestamptz)
            ON CONFLICT (teacher_id, provider) DO UPDATE SET status = 'active', last_error = NULL`.execute(deps.db);
}

export async function disconnectCalendar(deps: Deps, teacherId: string): Promise<void> {
  await sql`UPDATE calendar_connections SET status = 'revoked' WHERE teacher_id = ${teacherId}`.execute(deps.db);
}
