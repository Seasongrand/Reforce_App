'use client';

/**
 * Formulário da vitrine (GET /buscar): disciplina, série e modalidade; o CEP
 * aparece só na aula presencial. Na página de resultados, também preço
 * máximo e texto livre.
 */
import { useState } from 'react';
import type { SearchForm as Values, SearchModality } from '@/lib/search-form';
import { INPUT, LABEL, PRIMARY } from './ui';

type Option = { id: number; name: string };

const MODALITIES: Array<{ value: SearchModality; label: string }> = [
  { value: 'online', label: 'Online' },
  { value: 'at_student', label: 'Na minha casa' },
  { value: 'at_teacher', label: 'No endereço do professor' },
];

export function SearchForm({
  subjects, grades, values, advanced = false,
}: { subjects: Option[]; grades: Option[]; values?: Values; advanced?: boolean }) {
  const [modality, setModality] = useState<SearchModality>(values?.modality ?? 'online');
  return (
    <form action="/buscar" method="get" className="space-y-4 text-indigo-950">
      <div className="grid grid-cols-2 gap-3">
        <label className={LABEL}>Disciplina
          <select name="disciplina" required defaultValue={values?.subjectId ?? ''} className={INPUT}>
            <option value="" disabled>Escolha</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className={LABEL}>Série
          <select name="serie" required defaultValue={values?.gradeId ?? ''} className={INPUT}>
            <option value="" disabled>Escolha</option>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Onde</legend>
        <div className="flex flex-wrap gap-2">
          {MODALITIES.map((m) => (
            <label key={m.value}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-site-field bg-white px-4 text-sm has-checked:border-indigo-600 has-checked:bg-indigo-50">
              <input type="radio" name="modalidade" value={m.value} checked={modality === m.value}
                onChange={() => setModality(m.value)} className="size-4 accent-indigo-600" />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>
      {modality !== 'online' && (
        <label className={LABEL}>Seu CEP
          <input name="cep" required inputMode="numeric" autoComplete="postal-code" placeholder="00000-000"
            defaultValue={values?.cep ?? ''} className={INPUT} />
          <span className="text-[13px] font-normal text-site-muted">
            {modality === 'at_student' ? 'Para achar quem atende na sua região.' : 'Para achar professores perto de você.'}
          </span>
        </label>
      )}
      {advanced && (
        <div className="grid grid-cols-[8rem_1fr] gap-3">
          <label className={LABEL}>Até R$
            <input name="preco" inputMode="numeric" placeholder="sem limite"
              defaultValue={values?.maxPriceCents ? String(values.maxPriceCents / 100) : ''} className={INPUT} />
          </label>
          <label className={LABEL}>Nome ou assunto
            <input name="q" placeholder="opcional" defaultValue={values?.q ?? ''} className={INPUT} />
          </label>
        </div>
      )}
      <button className={PRIMARY}>Buscar professores</button>
    </form>
  );
}
