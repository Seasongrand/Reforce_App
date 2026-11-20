/**
 * Séries oferecidas na reserva e a que vem marcada. Oferece as séries em que
 * o professor dá a disciplina da aula (ou todas, se ele não cadastrou
 * nenhuma); marca a da busca, se estiver entre elas, ou a única, se houver uma
 * só. Senão, nada vem marcado e a família escolhe: uma série errada faz o
 * professor preparar a aula errada.
 */
import { GRADE_LEVELS } from '../catalog';

export function bookingGrades(input: {
  teaches: Array<{ subject: string; grades: string[] }>;
  subject: string;
  wanted?: string | null;
}): { grades: Array<{ slug: string; name: string }>; selected: string } {
  const names = new Set(input.teaches.find((t) => t.subject === input.subject)?.grades ?? []);
  const offered = GRADE_LEVELS.filter((g) => names.size === 0 || names.has(g.name)).map((g) => ({ slug: g.slug, name: g.name }));
  const wanted = offered.find((g) => g.slug === input.wanted);
  const selected = wanted?.slug ?? (offered.length === 1 ? offered[0]!.slug : '');
  return { grades: offered, selected };
}
