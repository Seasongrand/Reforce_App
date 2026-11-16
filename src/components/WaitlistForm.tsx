'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { ActionState } from '@/server/action-result';

type Option = { value: string; label: string };

export function WaitlistForm({
  action, subjects, stages, modalities, education,
}: {
  action: (prev: unknown, f: FormData) => Promise<ActionState<{ created: boolean }>>;
  subjects: Option[];
  stages: Option[];
  modalities: Option[];
  education: Option[];
}) {
  const [state, run, pending] = useActionState(action, null);
  if (state?.ok) {
    return (
      <div className="card space-y-2" role="status" data-testid="lista-ok">
        <p className="text-lg font-medium">Inscrição recebida. Obrigado!</p>
        <p className="text-sm text-slate-700">
          {state.data.created ? 'Vamos entrar em contato' : 'Atualizamos seus dados e vamos entrar em contato'} quando
          abrirmos a seleção de professores na sua região e disciplina.
        </p>
      </div>
    );
  }
  const checks = (name: string, options: Option[], legend: string) => (
    <fieldset>
      <legend className="label">{legend}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={name} value={o.value} /> {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
  return (
    <form action={run} className="card space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Nome completo<input className="input" name="name" required autoComplete="name" /></label>
        <label className="text-sm">E-mail<input className="input" name="email" type="email" required autoComplete="email" /></label>
        <label className="text-sm">WhatsApp (opcional)<input className="input" name="phone" autoComplete="tel" placeholder="(11) 99999-9999" /></label>
        <div className="grid grid-cols-[1fr_5rem] gap-2">
          <label className="text-sm">Cidade<input className="input" name="city" required autoComplete="address-level2" /></label>
          <label className="text-sm">UF<input className="input" name="state" required maxLength={2} autoComplete="address-level1" /></label>
        </div>
      </div>
      {checks('subject', subjects, 'Disciplinas')}
      {checks('stage', stages, 'Etapas')}
      {checks('modality', modalities, 'Modalidade')}
      <label className="block text-sm">Formação
        <select className="input" name="education" required defaultValue="">
          <option value="" disabled>Escolha</option>
          {education.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label className="block text-sm">Conte um pouco da sua experiência (opcional)
        <textarea className="input" name="notes" rows={3} maxLength={1000} />
      </label>
      {/* campo-armadilha para robôs: escondido de pessoas e de leitores de tela */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Site<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" required className="mt-1" />
        <span>Autorizo o contato por e-mail e WhatsApp sobre a seleção de professores, conforme a{' '}
          <Link className="text-brand underline" href="/privacidade">política de privacidade</Link>.</span>
      </label>
      {state && !state.ok && <p className="error" role="alert">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? 'Enviando…' : 'Entrar na lista de espera'}</button>
    </form>
  );
}
