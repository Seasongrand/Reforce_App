/**
 * Catálogo fechado (§2.2): disciplinas e séries são códigos. Os valores
 * iniciais seguem a sugestão do documento (§4) e estão em docs/pendencias.md.
 */
export const SUBJECTS = [
  { id: 1, slug: 'matematica', name: 'Matemática' },
  { id: 2, slug: 'fisica', name: 'Física' },
  { id: 3, slug: 'quimica', name: 'Química' },
  { id: 4, slug: 'redacao', name: 'Redação' },
] as const;

export const GRADE_LEVELS = [
  { id: 6, slug: '6ano', name: '6º ano', stage: 'fund2' },
  { id: 7, slug: '7ano', name: '7º ano', stage: 'fund2' },
  { id: 8, slug: '8ano', name: '8º ano', stage: 'fund2' },
  { id: 9, slug: '9ano', name: '9º ano', stage: 'fund2' },
  { id: 10, slug: '1serie', name: '1ª série do ensino médio', stage: 'medio' },
  { id: 11, slug: '2serie', name: '2ª série do ensino médio', stage: 'medio' },
  { id: 12, slug: '3serie', name: '3ª série do ensino médio', stage: 'medio' },
  { id: 13, slug: 'prevestibular', name: 'Pré-vestibular', stage: 'pre_vestibular' },
] as const;

export function subjectName(slug: string): string {
  return SUBJECTS.find((s) => s.slug === slug)?.name ?? slug;
}

export function gradeName(slug: string | null): string {
  if (!slug) return '';
  return GRADE_LEVELS.find((g) => g.slug === slug)?.name ?? slug;
}
