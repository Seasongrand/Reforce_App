'use client';

/**
 * Formulário da lista de espera em duas etapas (só na tela): as duas ficam no
 * DOM, a inativa escondida, e o envio leva tudo de uma vez para a mesma ação
 * do servidor, que continua decidindo. A etapa 1 é conferida antes de avançar.
 */
import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import type { ActionState } from '@/server/action-result';
import { step1Errors, stepOfServerError, type Step1Field } from '@/lib/waitlist-step1';
import { Chips, FormAlert, Honeypot, WhatsAppInvite, type Option } from './form-ui';

type Result = ActionState<{ created: boolean }>;

const STEP1: { name: Step1Field; label: string; type?: string; autoComplete: string; placeholder?: string; maxLength?: number }[] = [
  { name: 'name', label: 'Nome completo', autoComplete: 'name' },
  { name: 'email', label: 'E-mail', type: 'email', autoComplete: 'email' },
  { name: 'phone', label: 'WhatsApp (opcional)', type: 'tel', autoComplete: 'tel', placeholder: '(11) 99999-9999' },
  { name: 'city', label: 'Cidade', autoComplete: 'address-level2' },
  { name: 'state', label: 'UF', autoComplete: 'address-level1', maxLength: 2 },
];

const INVITE_TEXT = 'Estou na lista de espera da Reforce, plataforma de aulas particulares que cuida da agenda e do pagamento. Entra também: ';

export function WaitlistForm({
  action, subjects, stages, modalities, education, inviteUrl,
}: {
  action: (prev: unknown, f: FormData) => Promise<Result>;
  subjects: Option[];
  stages: Option[];
  modalities: Option[];
  education: Option[];
  inviteUrl: string;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Step1Field, string>>>({});
  const [serverError, setServerError] = useState<{ message: string; step: 1 | 2 } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titles = { 1: useRef<HTMLParagraphElement>(null), 2: useRef<HTMLParagraphElement>(null) };
  const moved = useRef(false);

  const goTo = (s: 1 | 2) => {
    moved.current = true;
    setStep(s);
  };

  const [state, run, pending] = useActionState(async (prev: unknown, f: FormData): Promise<Result> => {
    setServerError(null);
    const r = await action(prev, f);
    if (r && !r.ok) {
      const s = stepOfServerError(r.error);
      setServerError({ message: r.error, step: s });
      if (s === 1) goTo(1);
    }
    return r;
  }, null);

  // Ao trocar de etapa, o foco vai para o título dela (leitores de tela anunciam a etapa).
  useEffect(() => {
    if (moved.current) titles[step].current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function next() {
    const form = formRef.current!;
    const data = new FormData(form);
    const values = Object.fromEntries(STEP1.map(({ name }) => [name, String(data.get(name) ?? '')])) as Record<Step1Field, string>;
    const errors = step1Errors(values);
    setFieldErrors(errors);
    const firstInvalid = STEP1.find(({ name }) => errors[name]);
    if (firstInvalid) {
      (form.elements.namedItem(firstInvalid.name) as HTMLInputElement).focus();
      return;
    }
    if (serverError?.step === 1) setServerError(null);
    goTo(2);
  }

  if (state?.ok) {
    return (
      <div role="status" data-testid="lista-ok" className="form-done stack-4">
        <h3>Inscrição recebida!</h3>
        <p>
          {state.data.created ? 'Vamos entrar em contato' : 'Atualizamos seus dados e vamos entrar em contato'} quando abrirmos a
          seleção de professores na sua região e disciplina.
        </p>
        <p className="form-done__ask">Conhece outro professor que ia gostar?</p>
        <WhatsAppInvite text={INVITE_TEXT + inviteUrl} label="Convidar pelo WhatsApp" />
      </div>
    );
  }

  const alert = serverError && serverError.step === step && <FormAlert message={serverError.message} />;

  const field = ({ name, label, type, autoComplete, placeholder, maxLength }: (typeof STEP1)[number]) => (
    <div key={name} className={`field field--${name}`}>
      <label htmlFor={`lista-${name}`}>{label}</label>
      <input
        id={`lista-${name}`}
        name={name}
        type={type ?? 'text'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={fieldErrors[name] ? true : undefined}
        aria-describedby={fieldErrors[name] ? `erro-${name}` : undefined}
      />
      {fieldErrors[name] && <p id={`erro-${name}`} className="field__error">{fieldErrors[name]}</p>}
    </div>
  );

  const header = (n: 1 | 2, title: string) => (
    <div className="form-steps">
      <p ref={titles[n]} tabIndex={-1} className="t-label">{`Etapa ${n} de 2 · ${title}`}</p>
      <div className={`form-steps__bar${n === 2 ? ' is-full' : ''}`} aria-hidden="true" />
    </div>
  );

  return (
    // Envio por onSubmit, e não por `action`: com `action`, o React limpa o formulário depois de
    // cada envio, e uma recusa do servidor apagaria tudo o que a pessoa preencheu.
    <form
      ref={formRef}
      className="rf-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === 1) return next();
        const data = new FormData(e.currentTarget);
        startTransition(() => run(data));
      }}
    >
      <div
        hidden={step !== 1}
        className="rf-form__step"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
            e.preventDefault();
            next();
          }
        }}
      >
        {header(1, 'Seus dados')}
        {alert}
        <div className="rf-form__grid">{STEP1.map(field)}</div>
        <div className="btn-row"><button type="button" onClick={next} className="btn btn--primary">Continuar</button></div>
        <p className="t-small muted">Na próxima etapa: disciplinas, etapas e formação.</p>
      </div>

      <div hidden={step !== 2} className="rf-form__step">
        {header(2, 'Suas aulas')}
        {alert}
        <div className="rf-form__cols">
        <Chips name="subject" legend="Disciplinas" options={subjects} />
        <div className="rf-form__step">
        <Chips name="stage" legend="Etapas" options={stages} />
        <Chips name="modality" legend="Modalidade" options={modalities} />
        <div className="field">
          <label htmlFor="lista-education">Formação</label>
          <select id="lista-education" name="education" required defaultValue="">
            <option value="" disabled>Escolha</option>
            {education.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="lista-notes">Conte um pouco da sua experiência (opcional)</label>
          <textarea id="lista-notes" name="notes" rows={2} maxLength={1000} />
        </div>
        <div className="field">
          <label htmlFor="lista-cv">Currículo (opcional)</label>
          <input id="lista-cv" type="file" name="cv" aria-describedby="lista-cv-help"
            accept=".pdf,.doc,.docx,.odt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text" />
          <p id="lista-cv-help" className="t-small muted">PDF, DOC, DOCX ou ODT, até 5 MB. Só a equipe da Reforce vê.</p>
        </div>
        </div>
        </div>
        <Honeypot />
        <label className="consent">
          <input type="checkbox" name="consent" required />
          <span>
            Autorizo o contato por e-mail e WhatsApp sobre a seleção de professores, conforme a{' '}
            <a className="link" href="/privacidade">política de privacidade</a>.
          </span>
        </label>
        <div className="btn-row">
          <button type="button" onClick={() => goTo(1)} className="btn btn--secondary">Voltar</button>
          <button type="submit" disabled={pending} className="btn btn--primary">{pending ? 'Enviando…' : 'Entrar na lista de espera'}</button>
        </div>
      </div>
    </form>
  );
}
