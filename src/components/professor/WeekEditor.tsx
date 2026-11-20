'use client';

/**
 * "Sua semana" na Agenda: os horários de cada dia, "+ Adicionar horários"
 * (o mesmo horário em vários dias), "+" de um dia só e remoção com "Desfazer".
 */
import { useCallback, useState, useTransition } from 'react';
import type { ActionState } from '@/server/action-result';
import type { RuleInput } from '@/domain/teachers/schedule';
import { TimeField } from './TimeField';
import { UndoToast, type ToastMessage } from './UndoToast';

export interface WeekRule extends RuleInput { id: string }

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const DAYS_LONG = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
const br = (iso: string) => iso.split('-').reverse().join('/');

export function WeekEditor({ rules, addRules, removeRule, restoreRule }: {
  rules: WeekRule[];
  addRules: (f: FormData) => Promise<ActionState<{ added: number[]; conflicts: number[] }>>;
  removeRule: (id: string) => Promise<ActionState<RuleInput | null>>;
  restoreRule: (rule: RuleInput) => Promise<ActionState<unknown>>;
}) {
  const [panel, setPanel] = useState<Set<number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [pending, start] = useTransition();
  const closeToast = useCallback(() => setToast(null), []);

  const openPanel = (days: number[]) => { setPanel(new Set(days)); setError(null); };
  const toggle = (d: number) => setPanel((p) => {
    const next = new Set(p);
    if (next.has(d)) next.delete(d); else next.add(d);
    return next;
  });

  const submit = (form: HTMLFormElement) => {
    const f = new FormData(form);
    for (const d of panel ?? []) f.append('weekday', String(d));
    start(async () => {
      const r = await addRules(f);
      if (!r?.ok) { setError(r?.error ?? 'Algo deu errado. Tente de novo.'); return; }
      const { added, conflicts } = r.data;
      const when = `${f.get('start')} às ${f.get('end')}`;
      setPanel(null);
      const n = added.length;
      const addedText = n ? `Adicionado ${when} em ${n} ${n === 1 ? 'dia' : 'dias'}.` : '';
      const clash = conflicts.length ? ` ${conflicts.map((d) => DAYS_LONG[d - 1]).join(', ')} já tinha horário nesse período.` : '';
      setToast({ text: `${addedText}${clash}`.trim() });
    });
  };

  const remove = (rule: WeekRule) => start(async () => {
    const r = await removeRule(rule.id);
    if (!r?.ok || !r.data) return;
    const removed = r.data;
    setToast({
      text: `Horário de ${DAYS_LONG[removed.weekday - 1]}, ${removed.start} às ${removed.end}, removido.`,
      undo: () => start(async () => { await restoreRule(removed); }),
    });
  });

  const n = panel?.size ?? 0;
  const chip = (on: boolean) =>
    `min-h-11 min-w-13 rounded-xl border px-3 font-semibold ${on ? 'border-indigo-950 bg-indigo-950 text-white' : 'border-site-field bg-white'}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Sua semana</h2>
          <p className="text-sm text-site-muted">Os horários em que você aceita aulas, toda semana.</p>
        </div>
        <button type="button" className="btn" onClick={() => openPanel([1, 2, 3, 4, 5])}>+ Adicionar horários</button>
      </div>

      {panel && (
        <form className="space-y-4 rounded-2xl border-2 border-indigo-600 bg-indigo-50/40 p-4"
          onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
          <h3 className="font-display text-lg font-bold">Adicionar horários</h3>
          <div className="space-y-2">
            <p className="text-sm font-bold" id="dias-label">Em quais dias?</p>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="dias-label">
              {DAYS.map((d, i) => (
                <button key={d} type="button" aria-pressed={panel.has(i + 1)} onClick={() => toggle(i + 1)} className={chip(panel.has(i + 1))}>{d}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4">
              <button type="button" className="min-h-11 font-semibold text-indigo-600" onClick={() => setPanel(new Set([1, 2, 3, 4, 5]))}>Seg a Sex</button>
              <button type="button" className="min-h-11 font-semibold text-indigo-600" onClick={() => setPanel(new Set([1, 2, 3, 4, 5, 6, 7]))}>Todos os dias</button>
              <button type="button" className="min-h-11 font-semibold text-indigo-600" onClick={() => setPanel(new Set())}>Limpar</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TimeField name="start" label="Das" defaultValue="08:00" />
            <TimeField name="end" label="Até" defaultValue="12:00" />
          </div>
          <p className="text-[13px] text-site-muted">Digite o horário (por exemplo 7:45 ou 8h30) ou toque na setinha para escolher na lista.</p>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="flex flex-wrap gap-2.5">
            <button className="btn" disabled={n === 0 || pending}>
              {pending ? 'Salvando…' : n === 0 ? 'Escolha os dias' : n === 1 ? `Adicionar na ${DAYS_LONG[[...panel][0]! - 1]}` : `Adicionar em ${n} dias`}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setPanel(null)}>Cancelar</button>
          </div>
        </form>
      )}

      <ul className="divide-y divide-site-line" data-testid="semana">
        {DAYS.map((d, i) => {
          const list = rules.filter((r) => r.weekday === i + 1).sort((a, b) => a.start.localeCompare(b.start));
          return (
            <li key={d} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-2.5 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto]">
              <span className="font-display font-bold">{d}</span>
              <span className="col-span-2 row-start-2 flex min-w-0 flex-wrap gap-1.5 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                {list.length === 0 && <span className="text-sm text-site-muted">Folga</span>}
                {list.map((r) => (
                  <span key={r.id} className="inline-flex min-h-9 items-center rounded-xl bg-indigo-50 pl-3 text-sm font-semibold tabular-nums">
                    {r.start} – {r.end}
                    {(r.validFrom || r.validUntil) && (
                      <span className="ml-1.5 font-normal text-site-muted">({r.validFrom ? `de ${br(r.validFrom)}` : ''}{r.validUntil ? ` até ${br(r.validUntil)}` : ''})</span>
                    )}
                    <button type="button" disabled={pending} onClick={() => remove(r)} aria-label={`Remover ${DAYS_LONG[i]}, ${r.start} às ${r.end}`}
                      className="ml-0.5 flex size-9 items-center justify-center rounded-xl text-site-muted hover:bg-indigo-100 hover:text-indigo-950">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6 6 18" />
                      </svg>
                    </button>
                  </span>
                ))}
              </span>
              <button type="button" onClick={() => openPanel([i + 1])} aria-label={`Adicionar horário na ${DAYS_LONG[i]}`}
                className="col-start-2 row-start-1 flex size-11 items-center justify-center rounded-xl border border-dashed border-site-field text-indigo-600 sm:col-start-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>
      <UndoToast message={toast} onClose={closeToast} />
    </div>
  );
}
