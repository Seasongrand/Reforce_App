import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { MonthSlots } from '@/components/aluno/MonthSlots';
import { ExceptionsEditor } from '@/components/professor/ExceptionsEditor';
import { WeekEditor } from '@/components/professor/WeekEditor';
import { availableSlots } from '@/domain/availability';
import { PUBLIC_DAYS } from '@/domain/public/teacher-page';
import { SLOT_STEPS } from '@/domain/teachers/schedule';
import { zoneLabel } from '@/time/zoned';
import { appDeps, now } from '@/server/app';
import { requireTeacher } from '@/server/session';
import {
  addOverrideAction, addRulesAction, connectCalendarAction, disconnectCalendarAction, removeOverrideAction,
  removeRuleAction, restoreOverrideAction, restoreRuleAction, saveSettingsAction,
} from './actions';

export const dynamic = 'force-dynamic';

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);
const CARD = 'rounded-3xl border border-site-line bg-white p-5';

/** Opções das frases de "Regras de reserva", com o valor atual incluído se for diferente das sugestões. */
function options(values: Array<[number | '', string]>, current: number | '', label: (v: number) => string) {
  const list = values.some(([v]) => v === current) || current === '' ? values : [...values, [current, label(current)] as [number, string]];
  return list.map(([v, l]) => <option key={String(v)} value={v}>{l}</option>);
}
const minutesLabel = (m: number) => (m % 1440 === 0 ? `${m / 1440} ${m === 1440 ? 'dia' : 'dias'}` : m % 60 === 0 ? `${m / 60} ${m === 60 ? 'hora' : 'horas'}` : `${m} minutos`);

export default async function AgendaPage() {
  const teacherId = await requireTeacher();
  const deps = appDeps();
  const at = await now();
  const t = await deps.db.selectFrom('teachers')
    .select(['timezone', 'min_notice_min', 'horizon_days', 'slot_step_min', 'max_lessons_per_day'])
    .where('id', '=', teacherId).executeTakeFirstOrThrow();
  const today = at.toZonedDateTimeISO(t.timezone).toPlainDate().toString();
  const rules = await deps.db.selectFrom('availability_rules').selectAll().where('teacher_id', '=', teacherId)
    .orderBy('weekday').orderBy('start_local').execute();
  const overrides = await deps.db.selectFrom('availability_overrides').selectAll().where('teacher_id', '=', teacherId)
    .where('on_date', '>=', today).orderBy('on_date').execute();
  const cal = await deps.db.selectFrom('calendar_connections').select(['status', 'last_error'])
    .where('teacher_id', '=', teacherId).executeTakeFirst();
  const svc = await deps.db.selectFrom('services').select(['id', 'duration_min']).where('teacher_id', '=', teacherId)
    .where('active', '=', true).orderBy('duration_min').executeTakeFirst();
  const preview = svc
    ? (await availableSlots(deps, { teacherId, serviceId: svc.id, days: Math.min(t.horizon_days, PUBLIC_DAYS) }, at)).map((s) => s.toString())
    : null;

  const weekMinutes = rules.reduce((n, r) => {
    const [sh, sm] = r.start_local.split(':').map(Number) as [number, number];
    const [eh, em] = r.end_local.split(':').map(Number) as [number, number];
    return n + (eh * 60 + em) - (sh * 60 + sm);
  }, 0);
  const openDays = new Set(rules.map((r) => r.weekday)).size;
  const pill = 'inline-flex min-h-8 items-center rounded-full border border-site-line bg-white px-3 text-[13px] font-semibold';
  const sentence = 'flex flex-wrap items-center gap-2 font-semibold';
  const select = 'min-h-11 rounded-xl border border-site-field bg-white px-3 font-semibold';

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
      <div className="space-y-1.5 xl:col-span-2">
        <h1 className="font-display text-3xl font-bold">Agenda</h1>
        <p className="text-site-muted">Os alunos veem e reservam só os horários livres desta agenda. Horário de {zoneLabel(t.timezone)}.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <span className={pill}>{Math.round(weekMinutes / 60)} horas abertas por semana</span>
          <span className={pill}>{openDays} {openDays === 1 ? 'dia' : 'dias'} com aula</span>
        </div>
      </div>

      <div className="min-w-0 space-y-5">
        <section className={CARD}>
          <WeekEditor
            rules={rules.map((r) => ({
              id: r.id, weekday: r.weekday, start: hhmm(r.start_local)!, end: hhmm(r.end_local)!,
              validFrom: r.valid_from ? String(r.valid_from).slice(0, 10) : null, validUntil: r.valid_until ? String(r.valid_until).slice(0, 10) : null,
            }))}
            addRules={addRulesAction} removeRule={removeRuleAction} restoreRule={restoreRuleAction} />
        </section>

        <section className={`${CARD} xl:hidden`} aria-labelledby="previa-celular">
          <Preview id="previa-celular" slots={preview} tz={t.timezone} />
        </section>

        <section className={CARD}>
          <ExceptionsEditor
            items={overrides.map((o) => ({
              id: o.id, date: String(o.on_date).slice(0, 10), kind: o.kind as 'block' | 'extra', start: hhmm(o.start_local), end: hhmm(o.end_local),
            }))}
            today={today} add={addOverrideAction} remove={removeOverrideAction} restore={restoreOverrideAction} />
        </section>

        <section className={CARD} aria-labelledby="regras">
          <h2 id="regras" className="font-display text-xl font-bold">Regras de reserva</h2>
          <p className="text-sm text-site-muted">Valem para todas as suas aulas.</p>
          <ActionForm action={saveSettingsAction} submitLabel="Salvar regras" successMessage="Regras salvas." className="mt-3 divide-y divide-site-line">
            <div className="space-y-1 pb-3">
              <label className={sentence} htmlFor="minNoticeMin">Aceitar reservas com pelo menos
                <select id="minNoticeMin" name="minNoticeMin" className={select} defaultValue={t.min_notice_min}>
                  {options([[0, 'nenhuma'], [60, '1 hora'], [120, '2 horas'], [180, '3 horas'], [360, '6 horas'], [720, '12 horas'], [1440, '1 dia'], [2880, '2 dias'], [10080, '7 dias']], t.min_notice_min, minutesLabel)}
                </select> de antecedência</label>
              <p className="text-[13px] text-site-muted">Assim ninguém marca uma aula para daqui a 10 minutos.</p>
            </div>
            <div className="space-y-1 py-3">
              <label className={sentence} htmlFor="horizonDays">Mostrar horários para os próximos
                <select id="horizonDays" name="horizonDays" className={select} defaultValue={t.horizon_days}>
                  {options([[7, '7 dias'], [14, '14 dias'], [30, '30 dias'], [60, '60 dias'], [90, '90 dias'], [180, '180 dias']], t.horizon_days, (v) => `${v} dias`)}
                </select></label>
              <p className="text-[13px] text-site-muted">Depois disso a agenda fica fechada, para você não se comprometer cedo demais.</p>
            </div>
            <div className="space-y-1 py-3">
              <label className={sentence} htmlFor="slotStepMin">As aulas podem começar a cada
                <select id="slotStepMin" name="slotStepMin" className={select} defaultValue={t.slot_step_min}>
                  {SLOT_STEPS.map((x) => <option key={x} value={x}>{x === 60 ? '1 hora' : `${x} minutos`}</option>)}
                </select></label>
              <p className="text-[13px] text-site-muted">Com 30 minutos, por exemplo: 08:00, 08:30, 09:00…</p>
            </div>
            <div className="space-y-1 pb-1 pt-3">
              <label className={sentence} htmlFor="maxLessonsPerDay">Aulas por dia, no máximo:
                <select id="maxLessonsPerDay" name="maxLessonsPerDay" className={select} defaultValue={t.max_lessons_per_day ?? ''}>
                  {options([['', 'sem limite'], [2, '2 aulas'], [3, '3 aulas'], [4, '4 aulas'], [5, '5 aulas'], [6, '6 aulas'], [8, '8 aulas'], [10, '10 aulas']], t.max_lessons_per_day ?? '', (v) => `${v} aulas`)}
                </select></label>
              <p className="text-[13px] text-site-muted">Quando o dia chega ao limite, os outros horários dele somem da sua página.</p>
            </div>
          </ActionForm>
        </section>

        <section className={CARD} aria-labelledby="google">
          <h2 id="google" className="font-display text-xl font-bold">Google Agenda</h2>
          <p className="mt-1 text-sm text-site-muted">
            Conectada, seus compromissos pessoais bloqueiam os horários sozinhos. Usamos só o período ocupado, nunca o título.
            As aulas entram num calendário próprio, “Aulas”.
          </p>
          <div className="mt-3">
            {cal?.status === 'active' ? (
              <>
                <p className="text-sm font-semibold text-green-800">Conectada{cal.last_error ? ` (último erro: ${cal.last_error})` : ''}.</p>
                <ActionForm action={disconnectCalendarAction} submitLabel="Desconectar" className="mt-2" buttonClassName="btn-secondary" />
              </>
            ) : (
              <ActionForm action={connectCalendarAction} submitLabel="Conectar Google Agenda" className="" buttonClassName="btn-secondary" />
            )}
          </div>
        </section>
      </div>

      <section className={`${CARD} hidden xl:sticky xl:top-5 xl:block`} aria-labelledby="previa">
        <Preview id="previa" slots={preview} tz={t.timezone} />
      </section>
    </div>
  );
}

function Preview({ id, slots, tz }: { id: string; slots: string[] | null; tz: string }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 id={id} className="font-display text-xl font-bold">Como os alunos veem</h2>
        <p className="text-sm text-site-muted">O mês todo, para a sua aula mais curta. O número em cada dia é quantos horários estão livres.</p>
      </div>
      {slots === null ? (
        <p className="text-sm text-site-muted">
          Cadastre um <Link className="font-semibold text-indigo-600 underline" href="/professor/servicos">serviço</Link> para ver os horários.
        </p>
      ) : (
        <MonthSlots slots={slots} tz={tz} empty="Nenhum horário livre: adicione horários na sua semana." />
      )}
    </div>
  );
}
