'use client';

/**
 * "Avise-me quando abrir": o adulto responsável (ou o aluno maior de idade)
 * deixa e-mail, cidade, disciplinas e etapa. Envio por onSubmit, e não por
 * `action`: com `action`, o React limpa o formulário depois de cada envio, e
 * uma recusa do servidor apagaria o que a pessoa preencheu.
 */
import { startTransition, useActionState } from 'react';
import Link from 'next/link';
import type { ActionState } from '@/server/action-result';
import { Chips, FormAlert, Honeypot, INPUT, LABEL, SuccessMark, WhatsAppInvite, type Option } from './form-ui';

type Result = ActionState<{ created: boolean }>;

const INVITE_TEXT =
  'Conhece a Reforce? É uma plataforma de aulas particulares que cuida da agenda e do pagamento do professor. Entre na lista de espera: ';

export function StudentWaitlistForm({
  action, subjects, stages, teachersUrl,
}: {
  action: (prev: unknown, f: FormData) => Promise<Result>;
  subjects: Option[];
  stages: Option[];
  teachersUrl: string;
}) {
  const [state, run, pending] = useActionState(action, null);

  if (state?.ok) {
    return (
      <div role="status" data-testid="aviso-ok" className="flex flex-col items-start gap-3.5">
        <SuccessMark />
        <h2 className="font-display text-3xl font-bold">Pronto!</h2>
        <p className="leading-relaxed text-site-muted">
          {state.data.created ? 'Avisamos você' : 'Atualizamos seus dados e avisamos você'} por e-mail quando a Reforce abrir
          na sua cidade.
        </p>
        <p className="mt-2 font-semibold">Conhece um bom professor?</p>
        <WhatsAppInvite text={INVITE_TEXT + teachersUrl} label="Indicar a Reforce pelo WhatsApp" />
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => run(data));
      }}
    >
      <div className="space-y-1">
        <h2 className="font-display text-2xl font-bold">Avise-me quando abrir</h2>
        <p className="text-sm text-site-muted">Leva menos de um minuto. Sem custo e sem compromisso.</p>
      </div>
      {state && !state.ok && <FormAlert message={state.error} />}
      <label className={LABEL}>
        E-mail
        <input className={INPUT} name="email" type="email" required autoComplete="email" />
      </label>
      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <label className={LABEL}>
          Cidade
          <input className={INPUT} name="city" required autoComplete="address-level2" />
        </label>
        <label className={LABEL}>
          UF
          <input className={INPUT} name="state" required maxLength={2} autoComplete="address-level1" />
        </label>
      </div>
      <Chips name="subject" legend="Disciplinas" options={subjects} />
      <Chips name="stage" legend="Etapa" options={stages} />
      <Honeypot />
      <div className="space-y-1.5">
        <label className="flex items-start gap-2.5 text-sm leading-normal text-site-muted">
          <input type="checkbox" name="adult" required className="mt-1 size-4 accent-indigo-600" />
          <span>
            Tenho 18 anos ou mais e autorizo o aviso por e-mail sobre a abertura da Reforce, conforme a{' '}
            <Link className="text-indigo-600 underline" href="/privacidade">
              política de privacidade
            </Link>
            .
          </span>
        </label>
        <p className="pl-6.5 text-[13px] text-site-muted">Menor de 18 anos? Peça para seu responsável se inscrever.</p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="min-h-14 rounded-2xl bg-indigo-600 text-[17px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? 'Enviando…' : 'Quero ser avisado'}
      </button>
    </form>
  );
}
