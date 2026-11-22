'use client';

/**
 * "Avise-me quando abrir": o adulto responsável (ou o aluno maior de idade)
 * deixa e-mail, cidade, disciplinas e etapa. Envio por onSubmit, e não por
 * `action`: com `action`, o React limpa o formulário depois de cada envio, e
 * uma recusa do servidor apagaria o que a pessoa preencheu.
 */
import { startTransition, useActionState } from 'react';
import type { ActionState } from '@/server/action-result';
import { Chips, FormAlert, Honeypot, WhatsAppInvite, type Option } from './form-ui';

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
      <div role="status" data-testid="aviso-ok" className="form-done stack-4">
        <h2 className="t-h3">Pronto!</h2>
        <p>
          {state.data.created ? 'Avisamos você' : 'Atualizamos seus dados e avisamos você'} por e-mail quando a Reforce abrir
          na sua cidade.
        </p>
        <p className="form-done__ask">Conhece um bom professor?</p>
        <WhatsAppInvite text={INVITE_TEXT + teachersUrl} label="Indicar a Reforce pelo WhatsApp" />
      </div>
    );
  }

  return (
    <form
      className="rf-form rf-form__step"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => run(data));
      }}
    >
      <div className="stack-2">
        <h2 className="t-h3">Avise-me quando abrir</h2>
        <p className="t-small muted">Leva menos de um minuto. Sem custo e sem compromisso.</p>
      </div>
      {state && !state.ok && <FormAlert message={state.error} />}
      <div className="rf-form__grid">
        <div className="field field--email">
          <label htmlFor="aviso-email">E-mail</label>
          <input id="aviso-email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="field field--city">
          <label htmlFor="aviso-city">Cidade</label>
          <input id="aviso-city" name="city" required autoComplete="address-level2" />
        </div>
        <div className="field field--state">
          <label htmlFor="aviso-state">UF</label>
          <input id="aviso-state" name="state" required maxLength={2} autoComplete="address-level1" />
        </div>
      </div>
      <Chips name="subject" legend="Disciplinas" options={subjects} />
      <Chips name="stage" legend="Etapa" options={stages} />
      <Honeypot />
      <div className="stack-2">
        <label className="consent">
          <input type="checkbox" name="adult" required />
          <span>
            Tenho 18 anos ou mais e autorizo o aviso por e-mail sobre a abertura da Reforce, conforme a{' '}
            <a className="link" href="/privacidade">política de privacidade</a>.
          </span>
        </label>
        <p className="t-small muted">Menor de 18 anos? Peça para seu responsável se inscrever.</p>
      </div>
      <div className="btn-row">
        <button type="submit" disabled={pending} className="btn btn--primary">{pending ? 'Enviando…' : 'Quero ser avisado'}</button>
      </div>
    </form>
  );
}
