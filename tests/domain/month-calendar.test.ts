/** Calendário do mês (página do professor e prévia da Agenda): grade com segunda primeiro e meses com horário. */
import { describe, expect, it } from 'vitest';
import { monthGrid, monthsWithDays } from '@/lib/month-calendar';

describe('grade do mês', () => {
  it('novembro de 2026 começa num domingo: 6 casas vazias antes do dia 1, segunda primeiro', () => {
    const g = monthGrid(2026, 11);
    expect(g.slice(0, 7)).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(g.filter(Boolean)).toHaveLength(30);
    expect(g.at(-1)).toBe('2026-11-30');
  });

  it('mês que começa na segunda não tem casa vazia; fevereiro de 2027 tem 28 dias', () => {
    expect(monthGrid(2026, 6)[0]).toBe('2026-06-01');
    expect(monthGrid(2027, 2).filter(Boolean)).toHaveLength(28);
  });
});

describe('meses com horário', () => {
  it('do mês do primeiro dia ao do último, sem pular mês vazio no meio', () => {
    expect(monthsWithDays(['2026-11-20', '2026-11-21', '2027-01-15'])).toEqual([
      { year: 2026, month: 11 }, { year: 2026, month: 12 }, { year: 2027, month: 1 },
    ]);
    expect(monthsWithDays([])).toEqual([]);
  });
});
