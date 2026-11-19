import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { availableSlots } from '@/domain/availability';
import { SLOT_STEPS } from '@/domain/teachers/schedule';
import { formatDatePtBr, formatTime, groupByViewerDate } from '@/time/zoned';
import { Temporal } from 'temporal-polyfill';
import { appDeps, now } from '@/server/app';
import { requireTeacher } from '@/server/session';
import {
  addOverrideAction, addRuleAction, connectCalendarAction, disconnectCalendarAction, removeOverrideAction,
  removeRuleAction, saveSettingsAction,
} from './actions';

export const dynamic = 'force-dynamic';

const WEEKDAYS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const hhmm = (t: string) => t.slice(0, 5);

export default async function AgendaPage() {
  const teacherId = await requireTeacher();
  const deps = appDeps();
  const at = await now();
  const t = await deps.db.selectFrom('teachers')
    .select(['timezone', 'min_notice_min', 'horizon_days', 'slot_step_min', 'max_lessons_per_day'])
    .where('id', '=', teacherId).executeTakeFirstOrThrow();
  const rules = await deps.db.selectFrom('availability_rules').selectAll().where('teacher_id', '=', teacherId)
    .orderBy('weekday').orderBy('start_local').execute();
  const overrides = await deps.db.selectFrom('availability_overrides').selectAll().where('teacher_id', '=', teacherId)
    .where('on_date', '>=', at.toZonedDateTimeISO(t.timezone).toPlainDate().toString()).orderBy('on_date').execute();
  const cal = await deps.db.selectFrom('calendar_connections').select(['status', 'last_error'])
    .where('teacher_id', '=', teacherId).executeTakeFirst();
  const svc = await deps.db.selectFrom('services').select(['id', 'duration_min']).where('teacher_id', '=', teacherId)
    .where('active', '=', true).orderBy('duration_min').executeTakeFirst();
  const preview = svc ? groupByViewerDate(await availableSlots(deps, { teacherId, serviceId: svc.id, days: 7 }, at), t.timezone) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Agenda</h1>
      <p className="text-sm text-slate-600">Horários no fuso do seu perfil ({t.timezone}).</p>

      <section className="card space-y-3">
        <h2 className="font-medium">Horários semanais</h2>
        <ul className="space-y-1 text-sm" data-testid="regras">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between">
              <span>{WEEKDAYS[r.weekday]}, {hhmm(r.start_local)} às {hhmm(r.end_local)}
                {(r.valid_from || r.valid_until) && ` (de ${r.valid_from ?? '…'} a ${r.valid_until ?? '…'})`}</span>
              <ActionForm action={removeRuleAction} submitLabel="Remover" className="">
                <input type="hidden" name="id" value={r.id} />
              </ActionForm>
            </li>
          ))}
          {rules.length === 0 && <li className="text-slate-600">Nenhum horário ainda.</li>}
        </ul>
        <ActionForm action={addRuleAction} submitLabel="Adicionar horário" className="grid gap-2 sm:grid-cols-4">
          <select name="weekday" className="input" aria-label="Dia da semana">
            {WEEKDAYS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
          </select>
          <input name="start" type="time" className="input" aria-label="Início" required />
          <input name="end" type="time" className="input" aria-label="Fim" required />
          <span />
        </ActionForm>
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">Bloqueios e horários extras</h2>
        <ul className="space-y-1 text-sm">
          {overrides.map((o) => (
            <li key={o.id} className="flex items-center justify-between">
              <span>{o.on_date}: {o.kind === 'block' ? 'bloqueado' : 'horário extra'}
                {o.start_local ? `, ${hhmm(o.start_local)} às ${hhmm(o.end_local ?? '')}` : ', dia inteiro'}</span>
              <ActionForm action={removeOverrideAction} submitLabel="Remover" className="">
                <input type="hidden" name="id" value={o.id} />
              </ActionForm>
            </li>
          ))}
        </ul>
        <ActionForm action={addOverrideAction} submitLabel="Adicionar" className="grid gap-2 sm:grid-cols-5">
          <input name="date" type="date" className="input" aria-label="Data" required />
          <select name="kind" className="input" aria-label="Tipo">
            <option value="block">Bloquear</option>
            <option value="extra">Horário extra</option>
          </select>
          <input name="start" type="time" className="input" aria-label="Início (vazio: dia inteiro)" />
          <input name="end" type="time" className="input" aria-label="Fim" />
          <span />
        </ActionForm>
      </section>

      <section className="card">
        <h2 className="mb-3 font-medium">Ajustes</h2>
        <ActionForm action={saveSettingsAction} submitLabel="Salvar ajustes" successMessage="Ajustes salvos." className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Antecedência mínima (horas)
            <input name="minNoticeHours" className="input" inputMode="decimal" defaultValue={t.min_notice_min / 60} /></label>
          <label className="text-sm">Janela de agendamento (dias)
            <input name="horizonDays" className="input" inputMode="numeric" defaultValue={t.horizon_days} /></label>
          <label className="text-sm">Grade de horários (minutos)
            <select name="slotStepMin" className="input" defaultValue={t.slot_step_min}>
              {SLOT_STEPS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select></label>
          <label className="text-sm">Limite de aulas por dia (vazio: sem limite)
            <input name="maxLessonsPerDay" className="input" inputMode="numeric" defaultValue={t.max_lessons_per_day ?? ''} /></label>
        </ActionForm>
      </section>

      <section className="card space-y-2">
        <h2 className="font-medium">Calendário</h2>
        <p className="text-sm text-slate-600">
          Conectado, seus compromissos pessoais bloqueiam horários (só o período ocupado, nunca o título) e as aulas entram
          num calendário próprio, “Aulas”.
        </p>
        {cal?.status === 'active' ? (
          <>
            <p className="text-sm">Conectado{cal.last_error ? ` (último erro: ${cal.last_error})` : ''}.</p>
            <ActionForm action={disconnectCalendarAction} submitLabel="Desconectar" className="" />
          </>
        ) : (
          <ActionForm action={connectCalendarAction} submitLabel="Conectar Google Calendar" className="" />
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="font-medium">Próximos 7 dias livres</h2>
        {!svc && <p className="text-sm text-slate-600">Cadastre um <Link className="text-brand underline" href="/professor/servicos">serviço</Link> para ver os horários.</p>}
        {preview && preview.size === 0 && <p className="text-sm text-slate-600">Nenhum horário livre na semana.</p>}
        {preview && [...preview.entries()].map(([day, slots]) => (
          <p key={day} className="text-sm">
            <span className="font-medium">{formatDatePtBr(Temporal.PlainDate.from(day))}:</span>{' '}
            {slots.map((s) => formatTime(s, t.timezone)).join(', ')}
          </p>
        ))}
      </section>
    </div>
  );
}
