/**
 * Faixa de dias e horários do perfil do professor: agrupa pela data de quem
 * vê, no fuso do navegador (um aluno em Lisboa vê a aula das 22:00 de terça
 * em São Paulo na quarta).
 */
import { describe, expect, it } from 'vitest';
import { daysForPicker, shortWhen } from '@/lib/profile-days';

const tueNightSP = '2026-11-18T01:00:00Z'; // terça, 22:00 em São Paulo
const wedMorningSP = '2026-11-18T12:00:00Z'; // quarta, 09:00 em São Paulo

describe('dias e horários do perfil', () => {
  it('agrupa pelo dia de quem vê, em ordem', () => {
    expect(daysForPicker([wedMorningSP, tueNightSP], 'America/Sao_Paulo')).toEqual([
      { key: '2026-11-17', weekday: 'Ter', day: 17, month: 'nov', slots: [tueNightSP] },
      { key: '2026-11-18', weekday: 'Qua', day: 18, month: 'nov', slots: [wedMorningSP] },
    ]);
    expect(daysForPicker([wedMorningSP, tueNightSP], 'Europe/Lisbon')).toEqual([
      { key: '2026-11-18', weekday: 'Qua', day: 18, month: 'nov', slots: [tueNightSP, wedMorningSP] },
    ]);
    expect(daysForPicker([], 'America/Sao_Paulo')).toEqual([]);
  });

  it('resume o horário no fuso de quem vê', () => {
    expect(shortWhen(tueNightSP, 'America/Sao_Paulo')).toBe('Ter, 17 de nov · 22:00');
    expect(shortWhen(tueNightSP, 'Europe/Lisbon')).toBe('Qua, 18 de nov · 01:00');
  });
});
