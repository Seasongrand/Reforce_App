'use client';

/** Troca do e-mail em Meus dados: o código vai para o e-mail novo, que só passa a valer depois de confirmado. */
import { useActionState, useEffect, useState } from 'react';
import type { ActionState } from '@/server/action-result';
import { ALERT, INPUT, LABEL } from './ui';

type StartAction = (prev: unknown, form: FormData) => Promise<ActionState<{ codeId: string; sentTo: string }>>;
type FinishAction = (prev: unknown, form: FormData) => Promise<ActionState>;
const BTN = 'inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60';
const QUIET = 'inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-medium text-indigo-600';

export function EmailChange({ start, finish }: { start: StartAction; finish: FinishAction }) {
  const [startState, startRun, starting] = useActionState(start, null);
  const [finishState, finishRun, finishing] = useActionState(finish, null);
  const [closed, setClosed] = useState<string | null>(null); // código cancelado ou já usado
  const sent = startState?.ok && startState.data.codeId !== closed ? startState.data : null;
  const done = finishState?.ok ?? false;
  useEffect(() => { if (done && sent) setClosed(sent.codeId); }, [done, sent]);

  if (!sent) {
    return (
      <form action={startRun} className="max-w-xl space-y-3">
        <label className={LABEL}>E-mail novo<input className={INPUT} name="email" type="email" required autoComplete="email" /></label>
        {startState && !startState.ok && <p className={ALERT} role="alert">{startState.error}</p>}
        {done && <p className="rounded-[20px] bg-green-100 px-4 py-3 text-sm font-medium text-green-800" role="status">E-mail trocado.</p>}
        <button className={BTN} disabled={starting}>{starting ? 'Enviando…' : 'Enviar código'}</button>
      </form>
    );
  }
  return (
    <form action={finishRun} className="max-w-xl space-y-3">
      <p className="text-sm text-site-muted">Enviamos um código para <strong className="text-indigo-950">{sent.sentTo}</strong>. O e-mail só muda depois que você confirmar.</p>
      <input type="hidden" name="codeId" value={sent.codeId} />
      <label className={LABEL}>Código
        <input id="email-code" name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} placeholder="000000"
          className={`${INPUT} max-w-48 text-center font-display tracking-tight text-xl tracking-[0.3em]`} />
      </label>
      {finishState && !finishState.ok && <p className={ALERT} role="alert">{finishState.error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button className={BTN} disabled={finishing}>{finishing ? 'Conferindo…' : 'Confirmar'}</button>
        <button type="button" className={QUIET} onClick={() => setClosed(sent.codeId)}>Cancelar</button>
      </div>
    </form>
  );
}
