'use client';

/**
 * Criar conta sem comprar, em dois passos: os dados do adulto (e, se quiser,
 * do primeiro aluno) e o código enviado ao e-mail. O texto do segundo passo
 * não diz se o WhatsApp ou o e-mail já tinham conta.
 */
import { startTransition, useActionState, useEffect, useState } from 'react';
import { ResendCode } from '@/components/ResendCode';
import { GRADE_LEVELS } from '@/domain/catalog';
import type { ActionState } from '@/server/action-result';
import { ALERT, INPUT, LABEL, PRIMARY } from './ui';

type StartAction = (prev: unknown, form: FormData) => Promise<ActionState<{ codeId: string; sentTo: string }>>;
type FinishAction = (prev: unknown, form: FormData) => Promise<ActionState>;

export function SignupForm({ start, finish, next }: { start: StartAction; finish: FinishAction; next?: string | null }) {
  const [startState, startRun, starting] = useActionState(start, null);
  const [finishState, finishRun, finishing] = useActionState(finish, null);
  const [values, setValues] = useState<FormData | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null); // "Usar outro e-mail" volta ao primeiro passo
  const [tz, setTz] = useState('America/Sao_Paulo');
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  const sent = startState?.ok && startState.data.codeId !== dismissed ? startState.data : null;
  const v = (k: string) => (values?.get(k) as string | null) ?? undefined;

  if (!sent) {
    return (
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setValues(f);
        startTransition(() => startRun(f));
      }}>
        <input type="hidden" name="timezone" value={tz} />
        <label className={LABEL}>Seu nome<input className={INPUT} name="name" required autoComplete="name" defaultValue={v('name')} /></label>
        <label className={LABEL}>E-mail
          <input className={INPUT} name="email" type="email" required autoComplete="email" defaultValue={v('email')} />
          <span className="text-[13px] font-normal text-site-muted">Enviamos um código para confirmar. Não precisa de senha.</span>
        </label>
        <label className={LABEL}>WhatsApp
          <input className={INPUT} name="phone" type="tel" required autoComplete="tel" placeholder="(11) 99999-9999" defaultValue={v('phone')} />
        </label>
        <fieldset className="space-y-2.5 rounded-2xl border border-site-line p-4">
          <legend className="px-1 text-sm font-semibold">Primeiro aluno <span className="font-normal text-site-muted">(pode deixar para depois)</span></legend>
          <div className="grid grid-cols-2 gap-2.5">
            <label className={LABEL}>Primeiro nome
              <input className={INPUT} name="studentFirstName" defaultValue={v('studentFirstName')} />
            </label>
            <label className={LABEL}>Série
              <select className={INPUT} name="studentGrade" defaultValue={v('studentGrade') ?? ''}>
                <option value="">—</option>
                {GRADE_LEVELS.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
              </select>
            </label>
          </div>
          <p className="text-[13px] text-site-muted">Guardamos só o primeiro nome e a série. O aluno não tem login: a conta é sua.</p>
        </fieldset>
        <label className="flex items-start gap-2.5 text-sm leading-normal text-[#3b3870]">
          <input type="checkbox" name="whatsappOptIn" defaultChecked={v('whatsappOptIn') === 'on'} className="mt-0.5 size-5 flex-none accent-indigo-600" />
          Quero receber as confirmações e os lembretes das aulas pelo WhatsApp.
        </label>
        {startState && !startState.ok && <p className={ALERT} role="alert">{startState.error}</p>}
        <button className={PRIMARY} disabled={starting}>{starting ? 'Enviando…' : 'Criar conta'}</button>
      </form>
    );
  }

  const resend = () => { if (values) startTransition(() => startRun(values)); };
  return (
    <form action={finishRun} className="space-y-4">
      <p className="text-[15px] text-site-muted">
        Enviamos um código de 6 dígitos para <strong className="text-indigo-950">{sent.sentTo}</strong>. Se esse WhatsApp ou
        e-mail já tinha conta, você entra nela.
      </p>
      <input type="hidden" name="codeId" value={sent.codeId} />
      {next && <input type="hidden" name="voltar" value={next} />}
      <label className={LABEL}>Código
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} placeholder="000000"
          className="min-h-16 rounded-2xl border-2 border-indigo-600 px-4 text-center font-display text-3xl font-semibold tracking-[0.4em] focus:outline-none" />
      </label>
      {finishState && !finishState.ok && <p className={ALERT} role="alert">{finishState.error}</p>}
      <button className={PRIMARY} disabled={finishing}>{finishing ? 'Conferindo…' : 'Confirmar e entrar'}</button>
      <ResendCode codeId={sent.codeId} sending={starting} onResend={resend} onOtherEmail={() => setDismissed(sent.codeId)} />
    </form>
  );
}
