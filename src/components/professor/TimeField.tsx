'use client';

/**
 * Campo de horário da Agenda: o professor digita (8h, 830, 08:30...) ou
 * escolhe na lista da setinha. Ao sair do campo, o texto vira "HH:MM"; o
 * servidor confere de novo.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { parseTimeBR } from '@/lib/time-input';

const OPTIONS: string[] = [];
for (let m = 6 * 60; m <= 23 * 60 + 30; m += 30) {
  OPTIONS.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
}
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export function TimeField({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    const parsed = parseTimeBR(value);
    const target = parsed
      ? OPTIONS.reduce((a, b) => (Math.abs(minutes(b) - minutes(parsed)) < Math.abs(minutes(a) - minutes(parsed)) ? b : a))
      : null;
    list.current?.querySelector(`[data-value="${target}"]`)?.scrollIntoView({ block: 'center' });
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open, value]);

  return (
    <span className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <span ref={box} className="relative grid grid-cols-[minmax(0,1fr)_3rem]">
        <input id={id} name={name} value={value} inputMode="numeric" autoComplete="off" placeholder="08:00" aria-invalid={invalid}
          onChange={(e) => { setValue(e.target.value); setInvalid(false); }}
          onBlur={() => {
            const v = parseTimeBR(value);
            setInvalid(v === null);
            if (v) setValue(v);
          }}
          className={`min-h-12 w-full rounded-l-xl border px-3 text-lg font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-600/30 ${
            invalid ? 'border-red-700 bg-red-50' : 'border-site-field bg-white'}`} />
        <button type="button" aria-label={`Escolher ${label.toLowerCase()} na lista`} aria-expanded={open} aria-controls={`${id}-lista`}
          onClick={() => setOpen((o) => !o)}
          className={`flex min-h-12 items-center justify-center rounded-r-xl border border-l-0 border-site-field ${open ? 'bg-indigo-950 text-white' : 'bg-indigo-50 text-indigo-950'}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {open && (
          <ul ref={list} id={`${id}-lista`} role="listbox" aria-label={`Horários para ${label.toLowerCase()}`}
            className="absolute inset-x-0 top-[calc(100%+4px)] z-20 max-h-60 overflow-y-auto rounded-xl border border-site-field bg-white p-1">
            {OPTIONS.map((o) => (
              <li key={o} role="option" aria-selected={o === parseTimeBR(value)} data-value={o}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setValue(o); setInvalid(false); setOpen(false); }}
                className="flex min-h-11 cursor-pointer items-center rounded-lg px-3 font-medium tabular-nums hover:bg-indigo-50 aria-selected:bg-indigo-50">
                {o}
              </li>
            ))}
          </ul>
        )}
      </span>
    </span>
  );
}
