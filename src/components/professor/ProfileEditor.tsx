'use client';

/**
 * Editor do perfil do professor com prévia ao vivo: o formulário à esquerda
 * e, ao lado (no celular, abaixo), a página como os alunos vão ver, com o
 * mesmo componente da página pública. Envio por onSubmit, e não por
 * `action`: com `action`, o React limpa o formulário depois de cada envio.
 */
import { startTransition, useActionState, useState } from 'react';
import { TeacherProfileView } from '@/components/aluno/TeacherProfileView';
import { experienceText } from '@/lib/teacher-experience';
import type { ActionState } from '@/server/action-result';

type Modality = 'online' | 'at_teacher' | 'at_student';
type Option = { value: string; label: string };

export interface ProfileEditorProps {
  action: (prev: unknown, f: FormData) => Promise<ActionState>;
  initial: {
    displayName: string; slug: string; headline: string; bio: string; timezone: string; phone: string;
    whatsappOptIn: boolean; baseCep: string; travelRadiusKm: string; teachingAddress: string;
    /** Pares "disciplina:série" marcados. */
    subjects: string[];
    specialties: string[];
    teachingSince: string;
  };
  subjects: Array<{ id: number; name: string }>;
  grades: Array<{ id: number; name: string }>;
  timezones: Option[];
  specialties: Option[];
  maxSpecialties: number;
  baseUrl: string;
  /** Foto aprovada ou em análise, para a prévia. */
  photoUrl: string | null;
  verified: boolean;
  services: { minPriceCents: number | null; durations: number[]; modalities: Modality[] };
  currentYear: number;
}

export function ProfileEditor(p: ProfileEditorProps) {
  const [state, run, pending] = useActionState(p.action, null);
  const [name, setName] = useState(p.initial.displayName);
  const [headline, setHeadline] = useState(p.initial.headline);
  const [bio, setBio] = useState(p.initial.bio);
  const [since, setSince] = useState(p.initial.teachingSince);
  const [specialties, setSpecialties] = useState(() => new Set(p.initial.specialties));
  const [pairs, setPairs] = useState(() => new Set(p.initial.subjects));

  const toggle = (set: Set<string>, value: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(value);
    else next.delete(value);
    return next;
  };
  const sinceYear = /^\d{4}$/.test(since) ? Number(since) : null;
  const previewSubjects = p.subjects
    .map((s) => ({ subject: s.name, grades: p.grades.filter((g) => pairs.has(`${s.id}:${g.id}`)).map((g) => g.name) }))
    .filter((s) => s.grades.length > 0);
  const full = specialties.size >= p.maxSpecialties;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)]">
      <form
        className="card space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => run(data));
        }}
      >
        <div>
          <label className="label" htmlFor="displayName">Nome na página</label>
          <input className="input" id="displayName" name="displayName" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="slug">Endereço da sua página</label>
          <div className="flex min-w-0 items-center gap-1 text-sm text-site-muted">
            <span className="flex-none">{p.baseUrl.replace(/^https?:\/\//, '')}/p/</span>
            <input className="input min-w-0" id="slug" name="slug" required defaultValue={p.initial.slug} placeholder="ana-souza" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="headline">Chamada</label>
          <input className="input" id="headline" name="headline" maxLength={120} value={headline}
            onChange={(e) => setHeadline(e.target.value)} placeholder="Matemática para o 9º ano e ensino médio" />
        </div>
        <div>
          <label className="label" htmlFor="bio">Sobre você: formação e experiência</label>
          <textarea className="input" id="bio" name="bio" rows={5} maxLength={2000} value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="teachingSince">Ano em que começou a dar aula</label>
          <input className="input max-w-40" id="teachingSince" name="teachingSince" inputMode="numeric" maxLength={4}
            value={since} onChange={(e) => setSince(e.target.value.replace(/\D/g, ''))} placeholder="2015" />
          <p className="mt-1 text-[13px] text-site-muted">Aparece como “anos de experiência” na sua página.</p>
        </div>
        <fieldset>
          <legend className="label">Especialidades <span className="font-normal text-site-muted">({specialties.size} de {p.maxSpecialties})</span></legend>
          <div className="flex flex-wrap gap-2">
            {p.specialties.map((o) => {
              const on = specialties.has(o.value);
              return (
                <label key={o.value}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm ${on ? 'border-indigo-600 bg-indigo-50' : 'border-site-field'} ${!on && full ? 'opacity-50' : 'cursor-pointer'}`}>
                  <input type="checkbox" name="specialty" value={o.value} checked={on} disabled={!on && full}
                    onChange={(e) => setSpecialties((s) => toggle(s, o.value, e.target.checked))} className="size-4 accent-indigo-600" />
                  {o.label}
                </label>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">Disciplinas e séries</legend>
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr><th></th>{p.grades.map((g) => <th key={g.id} className="px-1 font-normal text-site-muted">{g.name}</th>)}</tr>
              </thead>
              <tbody>
                {p.subjects.map((s) => (
                  <tr key={s.id}>
                    <th className="pr-2 text-left font-medium">{s.name}</th>
                    {p.grades.map((g) => {
                      const key = `${s.id}:${g.id}`;
                      return (
                        <td key={g.id} className="text-center">
                          <input type="checkbox" name="subj" value={key} aria-label={`${s.name}, ${g.name}`} checked={pairs.has(key)}
                            onChange={(e) => setPairs((x) => toggle(x, key, e.target.checked))} className="size-4 accent-indigo-600" />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
        <div>
          <label className="label" htmlFor="timezone">Fuso horário da sua agenda</label>
          <select className="input" id="timezone" name="timezone" defaultValue={p.initial.timezone}>
            {p.timezones.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="phone">WhatsApp para avisos de aula</label>
            <input className="input" id="phone" name="phone" defaultValue={p.initial.phone} placeholder="(11) 99999-9999" />
          </div>
          <label className="flex items-center gap-2 text-sm sm:mt-7">
            <input type="checkbox" name="whatsappOptIn" defaultChecked={p.initial.whatsappOptIn} className="size-4 accent-indigo-600" />
            Aceito receber avisos de aula pelo WhatsApp
          </label>
        </div>
        <fieldset className="space-y-3">
          <legend className="label">Aula presencial</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="baseCep">CEP de onde você sai</label>
              <input className="input" id="baseCep" name="baseCep" defaultValue={p.initial.baseCep} />
            </div>
            <div>
              <label className="label" htmlFor="travelRadiusKm">Raio de atendimento (km)</label>
              <input className="input" id="travelRadiusKm" name="travelRadiusKm" inputMode="decimal" defaultValue={p.initial.travelRadiusKm} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="teachingAddress">Endereço onde você dá aula (só o aluno com aula paga vê)</label>
            <input className="input" id="teachingAddress" name="teachingAddress" defaultValue={p.initial.teachingAddress} />
          </div>
        </fieldset>
        {state && !state.ok && <p className="error" role="alert">{state.error}</p>}
        {state?.ok && <p className="notice" role="status">Perfil salvo.</p>}
        <button className="btn" disabled={pending}>{pending ? 'Salvando…' : 'Salvar perfil'}</button>
      </form>

      <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start" aria-label="Prévia da sua página">
        <p className="mb-2 text-sm font-semibold text-site-muted">Prévia: como os alunos veem</p>
        <div className="rounded-2xl border border-site-line bg-white p-5" data-testid="previa">
          <TeacherProfileView
            titleAs="h2"
            name={name.trim() || 'Seu nome'}
            photoUrl={p.photoUrl}
            verified={p.verified}
            headline={headline.trim() || null}
            experience={experienceText(sinceYear, p.currentYear)}
            minPriceCents={p.services.minPriceCents}
            durations={p.services.durations}
            modalities={p.services.modalities}
            specialties={p.specialties.filter((o) => specialties.has(o.value)).map((o) => o.label)}
            subjects={previewSubjects}
            bio={bio.trim() || null}
          />
        </div>
      </aside>
    </div>
  );
}
