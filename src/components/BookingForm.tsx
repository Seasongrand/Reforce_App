'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { Temporal } from 'temporal-polyfill';
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
  loggedIn: boolean;
  students: Array<{ id: string; firstName: string }>;
  addresses: Array<{ id: string; label: string }>;
  identify: Action;
  confirmAndHold: Action;
  holdAsGuardian: Action;
}

function Alternatives({ state, slug, serviceId }: { state: BookingState; slug: string; serviceId: string }) {
  const [tz, setTz] = useState('America/Sao_Paulo');
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  if (!state || state.ok) return null;
  return (
    <div className="error space-y-2" role="alert">
      <p>{state.error}</p>
      {state.alternatives && state.alternatives.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {state.alternatives.map((a) => (
            <li key={a}>
              <Link className="btn-secondary" href={`/p/${slug}/reservar?servico=${serviceId}&inicio=${encodeURIComponent(a)}`}>
                {formatPtBr(Temporal.Instant.from(a), tz)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddressFields() {
  return (
    <fieldset className="space-y-2">
      <legend className="label">Endereço da aula (o professor só vê depois do pagamento)</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        <input className="input" name="cep" placeholder="CEP" required aria-label="CEP" />
        <input className="input sm:col-span-2" name="street" placeholder="Rua" required aria-label="Rua" />
        <input className="input" name="number" placeholder="Número" aria-label="Número" />
        <input className="input" name="district" placeholder="Bairro" aria-label="Bairro" />
        <input className="input" name="city" placeholder="Cidade" required aria-label="Cidade" />
        <input className="input" name="state" placeholder="UF" required maxLength={2} aria-label="UF" />
      </div>
    </fieldset>
  );
}

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
      <form action={guardianRun} className="card space-y-4">
        {hidden}
        <fieldset className="space-y-2">
          <legend className="label">Aluno</legend>
          {p.students.map((s, i) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input type="radio" name="studentId" value={s.id} defaultChecked={i === 0} /> {s.firstName}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="studentId" value="" /> Outro aluno:</label>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="input" name="studentFirstName" placeholder="Primeiro nome" aria-label="Primeiro nome do aluno" />
            <select className="input" name="studentGrade" aria-label="Série">
              {p.grades.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
            </select>
          </div>
        </fieldset>
        {p.atStudent && (p.addresses.length > 0 ? (
          <label className="block text-sm">Endereço da aula
            <select className="input" name="addressId">{p.addresses.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
          </label>
        ) : <AddressFields />)}
        {/* depois do código, o cookie novo redesenha a página neste modo: mostra também o resultado daquela tentativa */}
        <Alternatives state={guardianState ?? holdState} slug={p.slug} serviceId={p.serviceId} />
        <button className="btn" disabled={guardianHolding}>{guardianHolding ? 'Reservando…' : 'Reservar e ir para o pagamento'}</button>
      </form>
    );
  }

  const sent = idState?.ok ? idState.data : null;
  if (!sent) {
    return (
      <form action={(f) => { setValues(Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)]))); identifyRun(f); }}
        className="card space-y-4">
        {hidden}
        <p className="text-sm text-slate-700">A conta é do responsável. O aluno não precisa de cadastro.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Seu nome<input className="input" name="name" required autoComplete="name" /></label>
          <label className="text-sm">WhatsApp<input className="input" name="phone" required autoComplete="tel" placeholder="(11) 99999-9999" /></label>
          <label className="text-sm sm:col-span-2">E-mail (enviamos um código para confirmar)
            <input className="input" name="email" type="email" required autoComplete="email" /></label>
          <label className="text-sm">Primeiro nome do aluno<input className="input" name="studentFirstName" required /></label>
          <label className="text-sm">Série do aluno
            <select className="input" name="studentGrade" required>
              {p.grades.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
            </select></label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="whatsappOptIn" defaultChecked /> Aceito receber a confirmação e os lembretes da aula pelo WhatsApp
        </label>
        {p.atStudent && <AddressFields />}
        {idState && !idState.ok && <p className="error" role="alert">{idState.error}</p>}
        <button className="btn" disabled={identifying}>{identifying ? 'Enviando…' : 'Continuar'}</button>
      </form>
    );
  }
  return (
    <form action={holdRun} className="card space-y-4">
      {hidden}
      {['cep', 'street', 'number', 'district', 'city', 'state'].map((k) => (
        <input key={k} type="hidden" name={k} value={values[k] ?? ''} />
      ))}
      <input type="hidden" name="codeId" value={sent.codeId} />
      <p className="text-sm text-slate-700">Enviamos um código de 6 dígitos para <strong>{sent.sentTo}</strong>.</p>
      <label className="block text-sm">Código
        <input id="code" name="code" className="input tracking-widest" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
      </label>
      <Alternatives state={holdState} slug={p.slug} serviceId={p.serviceId} />
      <button className="btn" disabled={holding}>{holding ? 'Reservando…' : 'Confirmar e reservar'}</button>
    </form>
  );
}
