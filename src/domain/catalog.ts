/**
 * Catálogo fechado (§2.2): disciplinas e séries são códigos. Desde 27/11, por
 * decisão do dono, a Reforce abre com todas as disciplinas da lista de espera,
 * com os mesmos ids (src/domain/waitlist.ts). O seed grava este catálogo no
 * banco a cada publicação (pré-deploy da Railway: db:migrate e db:seed).
 */
export const SUBJECTS = [
  { id: 1, slug: 'matematica', name: 'Matemática' },
  { id: 5, slug: 'lingua-portuguesa', name: 'Língua Portuguesa' },
  { id: 4, slug: 'redacao', name: 'Redação' },
  { id: 6, slug: 'literatura', name: 'Literatura' },
  { id: 2, slug: 'fisica', name: 'Física' },
  { id: 3, slug: 'quimica', name: 'Química' },
  { id: 7, slug: 'biologia', name: 'Biologia' },
  { id: 8, slug: 'ciencias', name: 'Ciências' },
  { id: 9, slug: 'historia', name: 'História' },
  { id: 10, slug: 'geografia', name: 'Geografia' },
  { id: 11, slug: 'filosofia', name: 'Filosofia' },
  { id: 12, slug: 'sociologia', name: 'Sociologia' },
  { id: 13, slug: 'ingles', name: 'Inglês' },
  { id: 14, slug: 'espanhol', name: 'Espanhol' },
  { id: 15, slug: 'arte', name: 'Arte' },
  { id: 16, slug: 'educacao-fisica', name: 'Educação Física' },
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
