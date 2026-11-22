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

/** "6º ano" → "6º"; "1ª série do ensino médio" → "1ª EM"; "Pré-vestibular" → "Pré-vest." (o nome completo vai no aria-label). */
function shortGrade(name: string): string {
  const year = /^(\d[ºª]) ano/.exec(name);
  if (year) return year[1]!;
  const em = /^(\d[ºª]) série/.exec(name);
  if (em) return `${em[1]} EM`;
  return name.startsWith('Pré') ? 'Pré-vest.' : name;
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
    // minmax(0, 1fr): a tabela de disciplinas rola dentro do cartão em vez de alargar a página no celular
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)]">
      <a href="#previa" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-site-field bg-white px-4 font-medium text-indigo-950 hover:bg-violet-50 lg:hidden">Ver como os alunos veem</a>
      <form
        className="card min-w-0 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => run(data));
        }}
      >
        <h3 className="border-t border-site-line pt-5 font-display tracking-tight text-lg font-normal first:border-0 first:pt-0">Sua página</h3>
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
        <h3 className="border-t border-site-line pt-5 font-display tracking-tight text-lg font-normal first:border-0 first:pt-0">O que você ensina</h3>
        <fieldset className="min-w-0">
          <legend className="label">Especialidades <span className="font-normal text-site-muted">({specialties.size} de {p.maxSpecialties})</span></legend>
          <div className="flex flex-wrap gap-2">
            {p.specialties.map((o) => {
              const on = specialties.has(o.value);
              return (
                <label key={o.value}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3.5 text-sm ${on ? 'border-indigo-600 bg-indigo-50' : 'border-site-field'} ${!on && full ? 'opacity-50' : 'cursor-pointer'}`}>
                  <input type="checkbox" name="specialty" value={o.value} checked={on} disabled={!on && full}
                    onChange={(e) => setSpecialties((s) => toggle(s, o.value, e.target.checked))} className="size-4 accent-indigo-600" />
                  {o.label}
                </label>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="min-w-0 space-y-2.5">
          <legend className="label">Disciplinas e séries</legend>
          {p.subjects.map((sub) => {
            const keys = p.grades.map((g) => `${sub.id}:${g.id}`);
            const all = keys.every((k) => pairs.has(k));
            return (
              <div key={sub.id} className="space-y-2 rounded-[20px] border border-site-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <strong>{sub.name}</strong>
                  <button type="button" className="min-h-11 px-1 text-sm font-medium text-indigo-600"
                    aria-label={all ? `Desmarcar as séries de ${sub.name}` : `Marcar todas as séries de ${sub.name}`}
                    onClick={() => setPairs((x) => { const next = new Set(x); for (const k of keys) { if (all) next.delete(k); else next.add(k); } return next; })}>
                    {all ? 'Nenhuma' : 'Todas'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.grades.map((g) => {
                    const key = `${sub.id}:${g.id}`;
                    const on = pairs.has(key);
                    return (
                      <label key={g.id} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium ${on ? 'border-indigo-600 bg-indigo-50' : 'border-site-field'}`}>
                        <input type="checkbox" name="subj" value={key} aria-label={`${sub.name}, ${g.name}`} checked={on}
                          onChange={(e) => setPairs((x) => toggle(x, key, e.target.checked))} className="size-5 accent-indigo-600" />
                        {shortGrade(g.name)}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </fieldset>
        <h3 className="border-t border-site-line pt-5 font-display tracking-tight text-lg font-normal first:border-0 first:pt-0">Contato</h3>
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
        <h3 className="border-t border-site-line pt-5 font-display tracking-tight text-lg font-normal first:border-0 first:pt-0">Aula presencial</h3>
        <fieldset className="space-y-3">
          <legend className="sr-only">Aula presencial</legend>
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

      <aside id="previa" className="min-w-0 scroll-mt-4 lg:sticky lg:top-6 lg:self-start" aria-label="Prévia da sua página">
        <p className="mb-2 text-sm font-medium text-site-muted">Prévia: como os alunos veem</p>
        <div className="rounded-[20px] border border-site-line bg-white p-5" data-testid="previa">
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
