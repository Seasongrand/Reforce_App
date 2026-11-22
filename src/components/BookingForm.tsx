'use client';

/**
 * Formulário da reserva (telas 2 e 3): dados do adulto responsável, código
 * de 6 dígitos e, para quem já se identificou, a escolha do aluno. As ações
 * do servidor e os nomes dos campos são os de sempre; só a tela mudou.
 */
import { startTransition, useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { Temporal } from 'temporal-polyfill';
import { ALERT, INPUT, LABEL, PRIMARY, TITLE } from '@/components/aluno/ui';
import { formatPtBr } from '@/time/zoned';
import type { BookingState } from '@/app/(aluno)/p/[slug]/reservar/actions';

type Action = (prev: unknown, f: FormData) => Promise<BookingState>;

interface Props {
  slug: string;
  serviceId: string;
  startsAt: string;
  idempotencyKey: string;
  atStudent: boolean;
  grades: Array<{ slug: string; name: string }>;
  /** Série marcada ao abrir; vazia: a família escolhe. */
  selectedGrade: string;
  loggedIn: boolean;
  students: Array<{ id: string; firstName: string }>;
  addresses: Array<{ id: string; label: string }>;
  holdMinutes: number;
  identify: Action;
  confirmAndHold: Action;
  holdAsGuardian: Action;
}

/** Horário ocupado (ou outra recusa da reserva): a mensagem e os horários livres mais próximos. */
function Alternatives({ state, slug, serviceId }: { state: BookingState; slug: string; serviceId: string }) {
  const [tz, setTz] = useState('America/Sao_Paulo');
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  if (!state || state.ok) return null;
  return (
    <div className={`${ALERT} space-y-3`} role="alert" data-testid="ocupado">
      <p>{state.error}</p>
      {state.alternatives && state.alternatives.length > 0 && (
        <>
          <p className="font-medium">Horários livres mais próximos:</p>
          <ul className="flex flex-wrap gap-2">
            {state.alternatives.map((a) => (
              <li key={a}>
                <Link className="inline-flex min-h-11 items-center rounded-lg border border-site-field bg-white px-3 font-medium text-indigo-950"
                  href={`/p/${slug}/reservar?servico=${serviceId}&inicio=${encodeURIComponent(a)}`}>
                  {formatPtBr(Temporal.Instant.from(a), tz)}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function AddressFields() {
  return (
    <fieldset className="space-y-2.5">
      <legend className="mb-2 text-sm font-medium">Endereço da aula</legend>
      <p className="text-[13px] text-site-muted">O professor só vê o endereço depois do pagamento.</p>
      <div className="grid grid-cols-[8rem_1fr] gap-2.5">
        <input className={INPUT} name="cep" placeholder="CEP" required aria-label="CEP" inputMode="numeric" autoComplete="postal-code" />
        <input className={INPUT} name="street" placeholder="Rua" required aria-label="Rua" autoComplete="address-line1" />
        <input className={INPUT} name="number" placeholder="Número" aria-label="Número" />
        <input className={INPUT} name="district" placeholder="Bairro" aria-label="Bairro" />
      </div>
      <div className="grid grid-cols-[1fr_5rem] gap-2.5">
        <input className={INPUT} name="city" placeholder="Cidade" required aria-label="Cidade" autoComplete="address-level2" />
        <input className={INPUT} name="state" placeholder="UF" required maxLength={2} aria-label="UF" autoComplete="address-level1" />
      </div>
    </fieldset>
  );
}

/** Opções de série; sem uma série certa, começa em "Escolha a série" (o envio exige escolher). */
function GradeOptions({ grades, selected }: { grades: Array<{ slug: string; name: string }>; selected: string }) {
  return (
    <>
      {!selected && <option value="" disabled>Escolha a série</option>}
      {grades.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
    </>
  );
}

const holdNote = (minutes: number) =>
  `Ao confirmar, o horário fica guardado para você por ${minutes} minutos enquanto paga.`;

export function BookingForm(p: Props) {
  const [idState, identifyRun, identifying] = useActionState(p.identify, null);
  const [holdState, holdRun, holding] = useActionState(p.confirmAndHold, null);
  const [guardianState, guardianRun, guardianHolding] = useActionState(p.holdAsGuardian, null);
  const [tz, setTz] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone), []);

  const hidden = (
    <>
      <input type="hidden" name="serviceId" value={p.serviceId} />
      <input type="hidden" name="startsAt" value={p.startsAt} />
      <input type="hidden" name="idempotencyKey" value={p.idempotencyKey} />
      <input type="hidden" name="timezone" value={tz} />
    </>
  );

  if (p.loggedIn) {
    return (
      <form action={guardianRun} className="space-y-5">
        {hidden}
        <h1 className={TITLE}>Para quem é a aula?</h1>
        <fieldset className="space-y-2.5">
          <legend className="sr-only">Aluno</legend>
          {p.students.map((s, i) => (
            <label key={s.id} className="flex min-h-12 items-center gap-3 rounded-lg border border-site-field px-4 has-checked:border-indigo-600 has-checked:bg-indigo-50">
              <input type="radio" name="studentId" value={s.id} defaultChecked={i === 0} className="size-4 accent-indigo-600" /> {s.firstName}
            </label>
          ))}
          <label className="flex min-h-12 items-center gap-3 rounded-lg border border-site-field px-4 has-checked:border-indigo-600 has-checked:bg-indigo-50">
            <input type="radio" name="studentId" value="" defaultChecked={p.students.length === 0} className="size-4 accent-indigo-600" />
            {p.students.length === 0 ? 'Novo aluno' : 'Outro aluno'}
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <input className={INPUT} name="studentFirstName" placeholder="Primeiro nome" aria-label="Primeiro nome do aluno" />
            <select className={INPUT} name="studentGrade" aria-label="Série" defaultValue={p.selectedGrade}>
              <GradeOptions grades={p.grades} selected={p.selectedGrade} />
            </select>
          </div>
        </fieldset>
        {p.atStudent && (p.addresses.length > 0 ? (
          <label className={LABEL}>Endereço da aula
            <select className={INPUT} name="addressId">{p.addresses.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
          </label>
        ) : <AddressFields />)}
        {/* depois do código, o cookie novo redesenha a página neste modo: mostra também o resultado daquela tentativa */}
        <Alternatives state={guardianState ?? holdState} slug={p.slug} serviceId={p.serviceId} />
        <button className={PRIMARY} disabled={guardianHolding}>{guardianHolding ? 'Reservando…' : 'Reservar e ir para o pagamento'}</button>
        <p className="text-sm text-site-muted">{holdNote(p.holdMinutes)}</p>
      </form>
    );
  }

  const sent = idState?.ok ? idState.data : null;
  if (!sent) {
    return (
      <form action={(f) => { setValues(Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)]))); identifyRun(f); }}
        className="space-y-5">
        {hidden}
        <div className="space-y-1.5">
          <h1 className={TITLE}>Quem está reservando?</h1>
          <p className="text-[15px] leading-normal text-site-muted">
            A reserva e o pagamento são feitos por um adulto responsável pelo aluno. Não precisa de senha.
          </p>
        </div>
        <label className={LABEL}>Seu nome<input className={INPUT} name="name" required autoComplete="name" /></label>
        <label className={LABEL}>WhatsApp<input className={INPUT} name="phone" required autoComplete="tel" type="tel" placeholder="(11) 99999-9999" /></label>
        <label className={LABEL}>E-mail
          <input className={INPUT} name="email" type="email" required autoComplete="email" />
          <span className="text-[13px] font-normal text-site-muted">Enviamos um código para confirmar.</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={LABEL}>Primeiro nome do aluno<input className={INPUT} name="studentFirstName" required /></label>
          <label className={LABEL}>Série
            <select className={INPUT} name="studentGrade" required defaultValue={values.studentGrade ?? p.selectedGrade}>
              <GradeOptions grades={p.grades} selected={p.selectedGrade} />
            </select>
          </label>
        </div>
        {p.atStudent && <AddressFields />}
        <label className="flex items-start gap-2.5 text-sm leading-normal text-[#3b3870]">
          <input type="checkbox" name="whatsappOptIn" defaultChecked={values.whatsappOptIn === 'on'} className="mt-0.5 size-5 flex-none accent-indigo-600" />
          Quero receber a confirmação e os lembretes da aula pelo WhatsApp (recomendado).
        </label>
        {idState && !idState.ok && <p className={ALERT} role="alert">{idState.error}</p>}
        <button className={PRIMARY} disabled={identifying}>{identifying ? 'Enviando…' : 'Continuar'}</button>
        <p className="text-center text-[13px] leading-normal text-site-muted">
          Seus dados ficam com a Reforce. O professor vê só o primeiro nome e a série do aluno
          {p.atStudent ? ' e, depois do pagamento, o endereço da aula' : ''}.
        </p>
      </form>
    );
  }

  const resend = () => {
    const f = new FormData();
    for (const [k, v] of Object.entries(values)) f.append(k, v);
    startTransition(() => identifyRun(f));
  };
  return (
    <form action={holdRun} className="space-y-5">
      {hidden}
      {['cep', 'street', 'number', 'district', 'city', 'state'].map((k) => (
        <input key={k} type="hidden" name={k} value={values[k] ?? ''} />
      ))}
      <input type="hidden" name="codeId" value={sent.codeId} />
      <div className="space-y-2">
        <h1 className={TITLE}>Confira seu e-mail</h1>
        <p className="text-[15px] leading-normal text-site-muted">
          Enviamos um código de 6 dígitos para <strong className="text-indigo-950">{sent.sentTo}</strong>.
        </p>
      </div>
      <label className={LABEL}>Código
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required placeholder="000000"
          className="min-h-16 rounded-[20px] border-2 border-indigo-600 px-4 text-center font-display tracking-tight text-3xl font-normal tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-indigo-600/30" />
      </label>
      <Alternatives state={holdState} slug={p.slug} serviceId={p.serviceId} />
      <button className={PRIMARY} disabled={holding}>{holding ? 'Reservando…' : 'Confirmar e reservar o horário'}</button>
      <p className="text-sm text-site-muted">{holdNote(p.holdMinutes)}</p>
      <div className="flex flex-wrap gap-x-5">
        <button type="button" onClick={resend} disabled={identifying}
          className="min-h-11 font-medium text-indigo-600 disabled:opacity-60">{identifying ? 'Reenviando…' : 'Reenviar código'}</button>
        <button type="button" onClick={() => window.location.reload()} className="min-h-11 font-medium text-indigo-600">Trocar e-mail</button>
      </div>
    </form>
  );
}
