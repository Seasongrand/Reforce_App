import { Temporal } from 'temporal-polyfill';

/**
 * Ocorrências semanais de uma aula, somando semanas na hora local (§2.1).
 * Nunca some 168 horas ao instante: na virada de horário de verão a aula
 * mudaria de hora. A conversão para instante fica a cargo do PostgreSQL.
 */
export function weeklyOccurrences(first: Temporal.PlainDateTime, count: number): Temporal.PlainDateTime[] {
  return Array.from({ length: count }, (_, k) => first.add({ weeks: k }));
}
