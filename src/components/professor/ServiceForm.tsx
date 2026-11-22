'use client';

/**
 * "Nova aula" em Serviços e preços: disciplina, onde, duração e preço, com o
 * quanto o professor recebe pelo link dele e pela busca enquanto digita. O
 * deslocamento só aparece na aula presencial.
 */
import { startTransition, useActionState, useEffect, useState } from 'react';
import { splitCommission } from '@/domain/payouts/split';
import { formatBRL, parsePriceBR } from '@/lib/money';
import type { ActionState } from '@/server/action-result';

const WHERE = [
  { value: 'online', label: 'Online' },
  { value: 'at_student', label: 'Na casa do aluno' },
  { value: 'at_teacher', label: 'No meu endereço' },
] as const;
const DURATIONS = [30, 45, 60, 90, 120];
const TRAVEL = [0, 15, 30, 45, 60];

export function ServiceForm({ subjects, linkBps, searchBps, action }: {
  subjects: Array<{ id: number; name: string }>;
  linkBps: number;
  searchBps: number;
  action: (prev: unknown, f: FormData) => Promise<ActionState<unknown>>;
}) {
  const [state, run, pending] = useActionState(action, null);
  const [where, setWhere] = useState<(typeof WHERE)[number]['value']>('online');
  const [price, setPrice] = useState('');
  useEffect(() => { if (state?.ok) setPrice(''); }, [state]);
  const cents = parsePriceBR(price);
  const take = (bps: number) => formatBRL(splitCommission(cents!, bps).teacher);
  const label = 'grid gap-1.5 text-sm font-medium';

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); startTransition(() => run(f)); }}>
      <label className={label}>Disciplina
        <select name="subjectId" className="input">{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Onde</legend>
        <div className="flex flex-wrap gap-2">
          {WHERE.map((w) => (
            <label key={w.value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-site-field px-3.5 font-medium has-checked:border-indigo-600 has-checked:bg-indigo-50">
              <input type="radio" name="modality" value={w.value} checked={where === w.value} onChange={() => setWhere(w.value)} className="size-5 accent-indigo-600" />
              {w.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>Duração
          <select name="durationMin" className="input" defaultValue={60}>
            {DURATIONS.map((d) => <option key={d} value={d}>{d < 60 ? `${d} minutos` : d === 60 ? '1 hora' : d % 60 ? `1 hora e ${d - 60} minutos` : `${d / 60} horas`}</option>)}
          </select>
        </label>
        <label className={label}>Preço da aula (R$)
          <input name="price" className="input" inputMode="decimal" required placeholder="120,00" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
      </div>
      <p className="rounded-xl bg-violet-50 px-3.5 py-2.5 text-sm" data-testid="voce-recebe" aria-live="polite">
        {cents && cents > 0
          ? <>Você recebe <strong>{take(linkBps)}</strong> pelo seu link e <strong>{take(searchBps)}</strong> pela busca.</>
          : 'Digite o preço para ver quanto você recebe.'}
      </p>
      {where !== 'online' && (
        <label className={label}>Deslocamento (antes e depois da aula)
          <select name="travelMin" className="input" defaultValue={30}>
            {TRAVEL.map((m) => <option key={m} value={m}>{m === 0 ? 'Sem deslocamento' : `${m} minutos`}</option>)}
          </select>
          <span className="text-[13px] font-normal text-site-muted">A agenda guarda esse tempo livre antes e depois de cada aula, para você chegar e sair.</span>
        </label>
      )}
      {state && !state.ok && <p className="error" role="alert">{state.error}</p>}
      {state?.ok && <p className="notice" role="status">Serviço criado.</p>}
      <button className="btn" disabled={pending}>{pending ? 'Salvando…' : 'Criar serviço'}</button>
    </form>
  );
}
