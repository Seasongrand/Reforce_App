'use client';

import { startTransition, useActionState, useState } from 'react';
import type { ActionState } from '@/server/action-result';
import { ResendCode } from './ResendCode';

type StartAction = (prev: unknown, form: FormData) => Promise<ActionState<{ codeId: string; sentTo: string }>>;
type FinishAction = (prev: unknown, form: FormData) => Promise<ActionState>;

/** Entrada sem senha em dois passos: e-mail, depois o código recebido (com reenvio e troca de e-mail). */
export function CodeLogin({ start, finish, emailLabel }: { start: StartAction; finish: FinishAction; emailLabel: string }) {
  const [startState, startAction, starting] = useActionState(start, null);
  const [finishState, finishAction, finishing] = useActionState(finish, null);
  const [email, setEmail] = useState('');
  const [dismissed, setDismissed] = useState<string | null>(null); // envio descartado por "Usar outro e-mail"
  const sent = startState?.ok && startState.data.codeId !== dismissed ? startState.data : null;

  if (!sent) {
    return (
      <form action={startAction} className="card space-y-4">
        <div>
          <label className="label" htmlFor="email">{emailLabel}</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {startState && !startState.ok && <p className="error" role="alert">{startState.error}</p>}
        <button className="btn" disabled={starting}>{starting ? 'Enviando…' : 'Receber código por e-mail'}</button>
      </form>
    );
  }
  const resend = () => {
    const f = new FormData();
    f.set('email', email);
    startTransition(() => startAction(f));
  };
  return (
    <form action={finishAction} className="card space-y-4">
      <p className="text-sm text-slate-700">Enviamos um código de 6 dígitos para <strong>{sent.sentTo}</strong>.</p>
      <input type="hidden" name="codeId" value={sent.codeId} />
      <div>
        <label className="label" htmlFor="code">Código</label>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={6}
          className="input tracking-widest" />
      </div>
      {finishState && !finishState.ok && <p className="error" role="alert">{finishState.error}</p>}
      <button className="btn" disabled={finishing}>{finishing ? 'Conferindo…' : 'Entrar'}</button>
      <ResendCode codeId={sent.codeId} sending={starting} onResend={resend} onOtherEmail={() => setDismissed(sent.codeId)} />
    </form>
  );
}
