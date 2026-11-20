'use client';

/**
 * "Folgas e horários extras" na Agenda: bloquear o dia todo ou um período, ou
 * abrir um horário extra num dia; remoção com "Desfazer".
 */
import { useCallback, useState, useTransition } from 'react';
import type { ActionState } from '@/server/action-result';
import type { OverrideInput } from '@/domain/teachers/schedule';
import { TimeField } from './TimeField';
import { UndoToast, type ToastMessage } from './UndoToast';

export interface Exception extends OverrideInput { id: string }

const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return `${WEEKDAYS[weekday]}, ${d} de ${MONTHS[m - 1]}`;
}
const what = (x: OverrideInput) => (x.kind === 'extra' ? 'Horário extra' : 'Bloqueio');

export function ExceptionsEditor({ items, today, add, remove, restore }: {
  items: Exception[];
  /** Hoje no fuso do professor (AAAA-MM-DD): o primeiro dia que dá para escolher. */
  today: string;
  add: (f: FormData) => Promise<ActionState<unknown>>;
  remove: (id: string) => Promise<ActionState<OverrideInput | null>>;
  restore: (o: OverrideInput) => Promise<ActionState<unknown>>;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'day' | 'block' | 'extra'>('day');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [pending, start] = useTransition();
  const closeToast = useCallback(() => setToast(null), []);

  const submit = (form: HTMLFormElement) => {
    const f = new FormData(form);
    start(async () => {
      const r = await add(f);
      if (!r?.ok) { setError(r?.error ?? 'Algo deu errado. Tente de novo.'); return; }
      setOpen(false);
      setToast({ text: `${kind === 'extra' ? 'Horário extra' : 'Folga'} de ${dayLabel(String(f.get('date')))} salvo.` });
    });
  };

  const removeOne = (x: Exception) => start(async () => {
    const r = await remove(x.id);
    if (!r?.ok || !r.data) return;
    const removed = r.data;
    setToast({ text: `${what(removed)} de ${dayLabel(removed.date)} removido.`, undo: () => start(async () => { await restore(removed); }) });
  });

  const option = 'flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-site-field px-4 font-semibold has-checked:border-indigo-600 has-checked:bg-indigo-50';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Folgas e horários extras</h2>
          <p className="text-sm text-site-muted">Vai viajar ou tem um compromisso? Bloqueie um dia ou um período. Também dá para abrir um horário só num dia.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => { setOpen(true); setError(null); }}>+ Folga ou horário extra</button>
      </div>

      {open && (
        <form className="space-y-4 rounded-2xl border-2 border-indigo-600 bg-indigo-50/40 p-4" onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
          <h3 className="font-display text-lg font-bold">Folga ou horário extra</h3>
          <label className="grid gap-1.5 text-sm font-bold">Dia
            <input type="date" name="date" required min={today} className="input" />
          </label>
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-sm font-bold">O que fazer</legend>
            <label className={option}><input type="radio" name="what" value="day" checked={kind === 'day'} onChange={() => setKind('day')} className="size-5 accent-indigo-600" /> Bloquear o dia todo</label>
            <label className={option}><input type="radio" name="what" value="block" checked={kind === 'block'} onChange={() => setKind('block')} className="size-5 accent-indigo-600" /> Bloquear um período</label>
            <label className={option}><input type="radio" name="what" value="extra" checked={kind === 'extra'} onChange={() => setKind('extra')} className="size-5 accent-indigo-600" /> Abrir um horário extra</label>
          </fieldset>
          {kind !== 'day' && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-3">
                <TimeField name="start" label="Das" defaultValue="14:00" />
                <TimeField name="end" label="Até" defaultValue="18:00" />
              </div>
              <p className="text-[13px] text-site-muted">Digite o horário ou toque na setinha para escolher na lista.</p>
            </div>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          <div className="flex flex-wrap gap-2.5">
            <button className="btn" disabled={pending}>{pending ? 'Salvando…' : kind === 'extra' ? 'Salvar horário extra' : 'Salvar folga'}</button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
          </div>
        </form>
      )}

      <ul className="space-y-2" data-testid="folgas">
        {items.length === 0 && <li className="text-sm text-site-muted">Nenhuma folga marcada.</li>}
        {items.map((x) => (
          <li key={x.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-site-line py-1.5 pl-4 pr-1.5">
            <span className="text-[15px]">
              <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${x.kind === 'extra' ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {x.kind === 'extra' ? 'Horário extra' : 'Bloqueado'}
              </span>
              <strong>{dayLabel(x.date)}</strong> · {x.start ? `${x.start} às ${x.end}` : 'dia todo'}
            </span>
            <button type="button" disabled={pending} onClick={() => removeOne(x)} aria-label={`Remover ${what(x).toLowerCase()} de ${dayLabel(x.date)}`}
              className="flex size-11 items-center justify-center rounded-xl text-site-muted hover:bg-violet-50 hover:text-indigo-950">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      <UndoToast message={toast} onClose={closeToast} />
    </div>
  );
}
