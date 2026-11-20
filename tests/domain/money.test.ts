/** Preço digitado pelo professor: vírgula ou ponto decimal, com ou sem milhar. */
import { describe, expect, it } from 'vitest';
import { parsePriceBR } from '@/lib/money';

describe('preço digitado', () => {
  it.each([
    ['121,00', 12100], ['121', 12100], ['121.00', 12100], ['121,5', 12150], ['121.5', 12150],
    ['1.234,56', 123456], ['1.234', 123400], ['R$ 150,00', 15000], [' 99,90 ', 9990], ['1234.56', 123456],
  ])('%s vira %i centavos', (typed, cents) => expect(parsePriceBR(typed)).toBe(cents));

  it.each(['', 'abc', '12,345', '-10', '1,2,3'])('%s é recusado', (typed) => expect(parsePriceBR(typed)).toBeNull());
});
