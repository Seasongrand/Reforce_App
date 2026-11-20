/** Horário digitado pelo professor na Agenda: vários jeitos de escrever, um formato guardado. */
import { describe, expect, it } from 'vitest';
import { parseTimeBR } from '@/lib/time-input';

describe('horário digitado', () => {
  it.each([
    ['8', '08:00'], ['08', '08:00'], ['8h', '08:00'], ['8h30', '08:30'], ['8H30', '08:30'], ['830', '08:30'],
    ['0830', '08:30'], ['8:30', '08:30'], ['08:30', '08:30'], ['8.30', '08:30'], [' 21:00 ', '21:00'], ['7:45', '07:45'],
    ['0', '00:00'], ['23:59', '23:59'], ['14h', '14:00'],
  ])('%s vira %s', (typed, saved) => expect(parseTimeBR(typed)).toBe(saved));

  it.each(['', 'oito', '25', '24:00', '8h70', '8:5', '12345', '8:30h30', '-1'])('%s é recusado', (typed) => {
    expect(parseTimeBR(typed)).toBeNull();
  });
});
