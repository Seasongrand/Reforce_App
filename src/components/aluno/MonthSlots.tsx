'use client';

/**
 * Calendário do mês com os horários livres: cada dia mostra quantos horários
 * tem; tocando no dia, aparecem os horários dele. Na página do professor o
 * aluno escolhe o horário (onPick); na prévia da Agenda é só para ver.
 */
import { useMemo, useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { monthGrid, monthsWithDays } from '@/lib/month-calendar';
import { daysForPicker } from '@/lib/profile-days';
import { formatTime } from '@/time/zoned';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const WEEKDAYS_LONG = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const count = (n: number) => `${n} ${n === 1 ? 'horário livre' : 'horários livres'}`;

export function MonthSlots({ slots, tz, selected = null, onPick, empty = 'Sem horários livres nos próximos dias.' }: {
  slots: string[];
  tz: string;
  selected?: string | null;
  onPick?: (slot: string) => void;
  empty?: string;
}) {
  const days = useMemo(() => daysForPicker(slots, tz), [slots, tz]);
  const byKey = useMemo(() => new Map(days.map((d) => [d.key, d])), [days]);
  const months = useMemo(() => monthsWithDays(days.map((d) => d.key)), [days]);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const day = (dayKey && byKey.get(dayKey)) || days[0];
  const [monthIdx, setMonthIdx] = useState<number | null>(null);
  const shownIdx = monthIdx ?? Math.max(0, months.findIndex((m) => day && day.key.startsWith(`${m.year}-${String(m.month).padStart(2, '0')}`)));
  const month = months[shownIdx];
  const goTo = (idx: number) => {
    const m = months[idx]!;
    const prefix = `${m.year}-${String(m.month).padStart(2, '0')}`;
    setMonthIdx(idx);
    const first = days.find((d) => d.key.startsWith(prefix));
    if (first) setDayKey(first.key);
  };

  if (!month || !day) return <p className="text-site-muted">{empty}</p>;
  const nav = 'inline-flex size-11 items-center justify-center rounded-xl border border-site-field bg-white text-lg font-medium disabled:opacity-35';
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className={nav} aria-label="Mês anterior" disabled={shownIdx === 0} onClick={() => goTo(shownIdx - 1)}>‹</button>
        <strong className="font-display tracking-tight text-[17px]" aria-live="polite">{capital(MONTHS[month.month - 1]!)} de {month.year}</strong>
        <button type="button" className={nav} aria-label="Próximo mês" disabled={shownIdx >= months.length - 1} onClick={() => goTo(shownIdx + 1)}>›</button>
      </div>
      <div role="group" aria-label="Dias do mês" className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => <span key={w} aria-hidden="true" className="pb-0.5 text-center text-xs font-medium text-site-muted">{w}</span>)}
        {monthGrid(month.year, month.month).map((key, i) => {
          if (!key) return <span key={`vazio-${i}`} />;
          const d = byKey.get(key);
          const date = Temporal.PlainDate.from(key);
          const on = d?.key === day.key;
          const label = `${WEEKDAYS_LONG[date.dayOfWeek - 1]}, ${date.day} de ${MONTHS[date.month - 1]}: ${d ? count(d.slots.length) : 'sem horário livre'}`;
          return (
            <button key={key} type="button" disabled={!d} aria-pressed={on} aria-label={label}
              onClick={() => setDayKey(key)}
              className={`flex min-h-12 flex-col items-center justify-center rounded-lg leading-tight ${
                on ? 'bg-indigo-950 text-white' : d ? 'border border-site-field bg-white' : 'text-[#b9b5dd]'}`}>
              <span className="font-display tracking-tight text-base font-normal">{date.day}</span>
              {d && <span className={`text-[11px] font-medium ${on ? 'text-indigo-200' : 'text-indigo-600'}`}>{d.slots.length}</span>}
            </button>
          );
        })}
      </div>
      <p className="text-[15px] font-medium">
        {capital(WEEKDAYS_LONG[Temporal.PlainDate.from(day.key).dayOfWeek - 1]!)}, {day.day} de {day.month} · {count(day.slots.length)}
      </p>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Horários">
        {day.slots.map((s) => {
          const time = formatTime(Temporal.Instant.from(s), tz);
          if (!onPick) {
            return <span key={s} className="flex min-h-11 items-center justify-center rounded-lg border border-site-field text-[15px] font-medium">{time}</span>;
          }
          const on = s === selected;
          return (
            <button key={s} type="button" data-slot={s} aria-pressed={on} onClick={() => onPick(s)}
              className={`min-h-12 rounded-xl text-[15px] font-medium ${on ? 'border-2 border-indigo-600 bg-indigo-50' : 'border border-site-field bg-white'}`}>
              {time}
            </button>
          );
        })}
      </div>
    </div>
  );
}
