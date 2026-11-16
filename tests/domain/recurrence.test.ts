import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { weeklyOccurrences } from '@/time/recurrence';

describe('recorrência soma semanas na hora local', () => {
  const tz = 'America/Sao_Paulo';
  const first = Temporal.PlainDateTime.from('2018-10-30T14:00');

  it('terça 14h em São Paulo, regras de 2018: 17:00Z e, uma semana depois, 16:00Z', () => {
    const [a, b] = weeklyOccurrences(first, 2);
    expect(a!.toZonedDateTime(tz).toInstant().toString()).toBe('2018-10-30T17:00:00Z');
    expect(b!.toZonedDateTime(tz).toInstant().toString()).toBe('2018-11-06T16:00:00Z');
    expect(b!.hour).toBe(14);
  });

  it('somar 168 horas ao instante leva a aula para as 15h', () => {
    const instant = first.toZonedDateTime(tz).toInstant().add({ hours: 168 });
    expect(instant.toZonedDateTimeISO(tz).hour).toBe(15);
  });

  it('gera N ocorrências semanais na mesma hora local', () => {
    const occ = weeklyOccurrences(Temporal.PlainDateTime.from('2026-11-17T14:00'), 4);
    expect(occ.map((d) => d.toString())).toEqual([
      '2026-11-17T14:00:00',
      '2026-11-24T14:00:00',
      '2026-12-01T14:00:00',
      '2026-12-08T14:00:00',
    ]);
  });
});
