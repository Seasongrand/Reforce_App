/**
 * Formulário da vitrine lido da URL (/buscar?disciplina=1&serie=9&modalidade=online).
 * Roda no servidor e no navegador. Valores fora do catálogo são ignorados,
 * como se não tivessem sido escolhidos.
 */
import { GRADE_LEVELS, SUBJECTS } from '@/domain/catalog';

export type SearchModality = 'online' | 'at_student' | 'at_teacher';
export const SEARCH_MODALITIES: SearchModality[] = ['online', 'at_student', 'at_teacher'];

export interface SearchForm {
  subjectId: number | null;
  gradeId: number | null;
  modality: SearchModality;
  /** Só dígitos; usado na aula presencial. */
  cep: string;
  maxPriceCents: number | null;
  q: string;
  page: number;
}

const int = (v: string | undefined) => (v && /^\d+$/.test(v.trim()) ? Number(v.trim()) : null);

export function parseSearchForm(p: Record<string, string | undefined>): SearchForm {
  const subject = int(p.disciplina);
  const grade = int(p.serie);
  const price = int(p.preco);
  const page = int(p.pagina);
  return {
    subjectId: SUBJECTS.some((s) => s.id === subject) ? subject : null,
    gradeId: GRADE_LEVELS.some((g) => g.id === grade) ? grade : null,
    modality: SEARCH_MODALITIES.includes(p.modalidade as SearchModality) ? (p.modalidade as SearchModality) : 'online',
    cep: (p.cep ?? '').replace(/\D/g, '').slice(0, 8),
    maxPriceCents: price && price > 0 ? price * 100 : null,
    q: (p.q ?? '').trim().slice(0, 80),
    page: page && page >= 1 ? page : 1,
  };
}
