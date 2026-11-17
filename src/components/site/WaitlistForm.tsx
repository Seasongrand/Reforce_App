'use client';

/**
 * Formulário da lista de espera em duas etapas (só na tela): as duas ficam no
 * DOM, a inativa escondida, e o envio leva tudo de uma vez para a mesma ação
 * do servidor, que continua decidindo. A etapa 1 é conferida antes de avançar.
 */
import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ActionState } from '@/server/action-result';
import { step1Errors, stepOfServerError, type Step1Field } from '@/lib/waitlist-step1';

type Option = { value: string; label: string };
type Result = ActionState<{ created: boolean }>;

const INPUT =
  'block min-h-12 w-full rounded-xl border border-site-field bg-white px-3.5 text-[15px] font-normal text-indigo-950 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/30 aria-[invalid=true]:border-red-600';
const LABEL = 'flex flex-col gap-1.5 text-sm font-semibold';

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
  const titles = { 1: useRef<HTMLHeadingElement>(null), 2: useRef<HTMLHeadingElement>(null) };
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
    const invite = `https://wa.me/?text=${encodeURIComponent(INVITE_TEXT + inviteUrl)}`;
    return (
      <div role="status" data-testid="lista-ok" className="flex flex-col items-start gap-3.5">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-green-100 text-green-800">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h3 className="font-display text-3xl font-bold">Inscrição recebida!</h3>
        <p className="leading-relaxed text-site-muted">
          {state.data.created ? 'Vamos entrar em contato' : 'Atualizamos seus dados e vamos entrar em contato'} quando abrirmos a
          seleção de professores na sua região e disciplina.
        </p>
        <p className="mt-2 font-semibold">Conhece outro professor que ia gostar?</p>
        <a
          href={invite}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-13 items-center rounded-2xl bg-green-700 px-5 font-semibold text-white hover:bg-green-800"
        >
          Convidar pelo WhatsApp
        </a>
      </div>
    );
  }

  const alert = serverError && serverError.step === step && (
    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
      {serverError.message}
    </p>
  );

  const field = ({ name, label, type, autoComplete, placeholder, maxLength }: (typeof STEP1)[number]) => (
    <div key={name}>
      <label className={LABEL}>
        {label}
        <input
          className={INPUT}
          name={name}
          type={type ?? 'text'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-invalid={fieldErrors[name] ? true : undefined}
          aria-describedby={fieldErrors[name] ? `erro-${name}` : undefined}
        />
      </label>
      {fieldErrors[name] && (
        <p id={`erro-${name}`} className="mt-1 text-sm text-red-700">
          {fieldErrors[name]}
        </p>
      )}
    </div>
  );

  const chips = (name: string, legend: string, options: Option[]) => (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-site-field px-4 text-sm has-checked:border-indigo-600 has-checked:bg-indigo-50"
          >
            <input type="checkbox" name={name} value={o.value} className="size-4 accent-indigo-600" /> {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );

  const header = (n: 1 | 2, title: string) => (
    <div className="flex flex-col gap-2.5">
      <h3 ref={titles[n]} tabIndex={-1} className="text-sm font-semibold text-site-muted outline-none">
        {`Etapa ${n} de 2 · ${title}`}
      </h3>
      <div className="grid grid-cols-2 gap-1.5" aria-hidden="true">
        <span className="h-1.5 rounded-full bg-indigo-600" />
        <span className={`h-1.5 rounded-full ${n === 2 ? 'bg-indigo-600' : 'bg-site-line'}`} />
      </div>
    </div>
  );

  return (
    // Envio por onSubmit, e não por `action`: com `action`, o React limpa o formulário depois de
    // cada envio, e uma recusa do servidor apagaria tudo o que a pessoa preencheu.
    <form
      ref={formRef}
      className="flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === 1) return next();
        const data = new FormData(e.currentTarget);
        startTransition(() => run(data));
      }}
    >
      <div
        hidden={step !== 1}
        className="flex flex-col gap-5"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
            e.preventDefault();
            next();
          }
        }}
      >
        {header(1, 'Seus dados')}
        {alert}
        <div className="grid gap-3.5 sm:grid-cols-2">
          {STEP1.slice(0, 3).map(field)}
          <div className="grid grid-cols-[1fr_5rem] gap-3">{STEP1.slice(3).map(field)}</div>
        </div>
        <button
          type="button"
          onClick={next}
          className="min-h-14 rounded-2xl bg-indigo-600 text-[17px] font-semibold text-white hover:bg-indigo-700"
        >
          Continuar
        </button>
        <p className="text-center text-[13px] text-site-muted">Na próxima etapa: disciplinas, etapas e formação.</p>
      </div>

      <div hidden={step !== 2} className="flex flex-col gap-5">
        {header(2, 'Suas aulas')}
        {alert}
        {chips('subject', 'Disciplinas', subjects)}
        {chips('stage', 'Etapas', stages)}
        {chips('modality', 'Modalidade', modalities)}
        <label className={LABEL}>
          Formação
          <select className={INPUT} name="education" required defaultValue="">
            <option value="" disabled>
              Escolha
            </option>
            {education.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          Conte um pouco da sua experiência (opcional)
          <textarea className={`${INPUT} py-3`} name="notes" rows={3} maxLength={1000} />
        </label>
        {/* campo-armadilha para robôs: escondido de pessoas e de leitores de tela */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Site
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <label className="flex items-start gap-2.5 text-sm leading-normal text-site-muted">
          <input type="checkbox" name="consent" required className="mt-1 size-4 accent-indigo-600" />
          <span>
            Autorizo o contato por e-mail e WhatsApp sobre a seleção de professores, conforme a{' '}
            <Link className="text-indigo-600 underline" href="/privacidade">
              política de privacidade
            </Link>
            .
          </span>
        </label>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => goTo(1)}
            className="min-h-14 rounded-2xl border border-site-field px-6 font-semibold text-indigo-950 hover:bg-violet-50"
          >
            Voltar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="min-h-14 flex-[1_1_14rem] rounded-2xl bg-indigo-600 text-[17px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {pending ? 'Enviando…' : 'Entrar na lista de espera'}
          </button>
        </div>
      </div>
    </form>
  );
}
