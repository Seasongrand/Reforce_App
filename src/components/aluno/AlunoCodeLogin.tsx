'use client';

/** Entrada sem senha em dois passos (e-mail e código), no visual das telas do aluno. */
import { useActionState } from 'react';
import type { ActionState } from '@/server/action-result';
import { ALERT, INPUT, LABEL, PRIMARY } from './ui';

type StartAction = (prev: unknown, form: FormData) => Promise<ActionState<{ codeId: string; sentTo: string }>>;
type FinishAction = (prev: unknown, form: FormData) => Promise<ActionState>;

export function AlunoCodeLogin({ start, finish }: { start: StartAction; finish: FinishAction }) {
  const [startState, startRun, starting] = useActionState(start, null);
  const [finishState, finishRun, finishing] = useActionState(finish, null);
  const sent = startState?.ok ? startState.data : null;
  if (!sent) {
    return (
      <form action={startRun} className="space-y-4">
        <label className={LABEL}>E-mail que você usou na reserva
          <input id="email" name="email" type="email" required autoComplete="email" className={INPUT} />
        </label>
        {startState && !startState.ok && <p className={ALERT} role="alert">{startState.error}</p>}
        <button className={PRIMARY} disabled={starting}>{starting ? 'Enviando…' : 'Receber código por e-mail'}</button>
      </form>
    );
  }
  return (
    <form action={finishRun} className="space-y-4">
      <p className="text-[15px] text-site-muted">
        Se esse e-mail tiver uma conta, enviamos um código de 6 dígitos para <strong className="text-indigo-950">{sent.sentTo}</strong>.
      </p>
      <input type="hidden" name="codeId" value={sent.codeId} />
      <label className={LABEL}>Código
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} placeholder="000000"
          className="min-h-16 rounded-2xl border-2 border-indigo-600 px-4 text-center font-display text-3xl font-semibold tracking-[0.4em] focus:outline-none" />
      </label>
      {finishState && !finishState.ok && <p className={ALERT} role="alert">{finishState.error}</p>}
      <button className={PRIMARY} disabled={finishing}>{finishing ? 'Conferindo…' : 'Entrar'}</button>
    </form>
  );
}
