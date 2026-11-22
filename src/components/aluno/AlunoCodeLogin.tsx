'use client';

/** Entrada sem senha em dois passos (e-mail e código), no visual das telas do aluno, com reenvio e troca de e-mail. */
import { startTransition, useActionState, useState } from 'react';
import { ResendCode } from '@/components/ResendCode';
import type { ActionState } from '@/server/action-result';
import { ALERT, INPUT, LABEL, PRIMARY } from './ui';

type StartAction = (prev: unknown, form: FormData) => Promise<ActionState<{ codeId: string; sentTo: string }>>;
type FinishAction = (prev: unknown, form: FormData) => Promise<ActionState>;

export function AlunoCodeLogin({ start, finish, next }: { start: StartAction; finish: FinishAction; next?: string | null }) {
  const [startState, startRun, starting] = useActionState(start, null);
  const [finishState, finishRun, finishing] = useActionState(finish, null);
  const [email, setEmail] = useState('');
  const [dismissed, setDismissed] = useState<string | null>(null); // envio descartado por "Usar outro e-mail"
  const sent = startState?.ok && startState.data.codeId !== dismissed ? startState.data : null;
  if (!sent) {
    return (
      <form action={startRun} className="space-y-4">
        <label className={LABEL}>E-mail que você usou na reserva
          <input id="email" name="email" type="email" required autoComplete="email" className={INPUT}
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {startState && !startState.ok && <p className={ALERT} role="alert">{startState.error}</p>}
        <button className={PRIMARY} disabled={starting}>{starting ? 'Enviando…' : 'Receber código por e-mail'}</button>
      </form>
    );
  }
  const resend = () => {
    const f = new FormData();
    f.set('email', email);
    startTransition(() => startRun(f));
  };
  return (
    <form action={finishRun} className="space-y-4">
      <p className="text-[15px] text-site-muted">
        Se esse e-mail tiver uma conta, enviamos um código de 6 dígitos para <strong className="text-indigo-950">{sent.sentTo}</strong>.
      </p>
      <input type="hidden" name="codeId" value={sent.codeId} />
      {next && <input type="hidden" name="voltar" value={next} />}
      <label className={LABEL}>Código
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} placeholder="000000"
          className="min-h-16 rounded-[20px] border-2 border-indigo-600 px-4 text-center font-display tracking-tight text-3xl font-normal tracking-[0.4em] focus:outline-none" />
      </label>
      {finishState && !finishState.ok && <p className={ALERT} role="alert">{finishState.error}</p>}
      <button className={PRIMARY} disabled={finishing}>{finishing ? 'Conferindo…' : 'Entrar'}</button>
      <ResendCode codeId={sent.codeId} sending={starting} onResend={resend} onOtherEmail={() => setDismissed(sent.codeId)} />
    </form>
  );
}
