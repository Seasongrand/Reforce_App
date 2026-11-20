/** Telefone e distância no formato que o brasileiro lê. */
import { describe, expect, it } from 'vitest';
import { formatKm, formatPhoneBR } from '@/lib/format-br';

describe('formatos brasileiros', () => {
  it('telefone salvo no padrão internacional aparece como (DDD) número', () => {
    expect(formatPhoneBR('+5511977776666')).toBe('(11) 97777-6666');
    expect(formatPhoneBR('+552133334444')).toBe('(21) 3333-4444');
    expect(formatPhoneBR(null)).toBe('');
    expect(formatPhoneBR('')).toBe('');
    expect(formatPhoneBR('não é telefone')).toBe('não é telefone');
  });

  it('distância sem ".0" e com vírgula decimal', () => {
    expect(formatKm('5.0')).toBe('5');
    expect(formatKm('5.5')).toBe('5,5');
    expect(formatKm(12)).toBe('12');
    expect(formatKm(null)).toBe('');
    expect(formatKm('')).toBe('');
  });
});
