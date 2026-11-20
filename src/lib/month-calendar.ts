/**
 * Calendário do mês com os horários livres (página do professor e prévia da
 * Agenda). Datas como texto AAAA-MM-DD, no fuso de quem vê; segunda primeiro.
 */
import { Temporal } from 'temporal-polyfill';

/** Casas do mês: null antes do dia 1, para a primeira linha começar na segunda. */
export function monthGrid(year: number, month: number): Array<string | null> {
  const first = Temporal.PlainDate.from({ year, month, day: 1 });
  const cells: Array<string | null> = Array.from({ length: first.dayOfWeek - 1 }, () => null);
  for (let d = first; d.month === month; d = d.add({ days: 1 })) cells.push(d.toString());
  return cells;
}

/** Meses do primeiro ao último dia da lista (inclusive os do meio, mesmo sem horário). */
export function monthsWithDays(keys: string[]): Array<{ year: number; month: number }> {
  if (keys.length === 0) return [];
  const sorted = [...keys].sort();
  let cur = Temporal.PlainYearMonth.from(sorted[0]!.slice(0, 7));
  const last = Temporal.PlainYearMonth.from(sorted.at(-1)!.slice(0, 7));
  const out: Array<{ year: number; month: number }> = [];
  while (Temporal.PlainYearMonth.compare(cur, last) <= 0) {
    out.push({ year: cur.year, month: cur.month });
    cur = cur.add({ months: 1 });
  }
  return out;
}
