import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import {
  bothTimes,
  formatPtBr,
  groupByViewerDate,
  instantFromDb,
  plainFromDb,
  plainToDb,
  toLocal,
} from '@/time/zoned';

const SP = 'America/Sao_Paulo';
const MANAUS = 'America/Manaus';
const at = (s: string) => Temporal.Instant.from(s);

describe('conversões de fuso', () => {
  it('instante para hora local do professor', () => {
    expect(toLocal(at('2026-11-17T17:00:00Z'), SP).toString()).toBe('2026-11-17T14:00:00');
  });

  it('lê timestamptz no formato de texto do PostgreSQL', () => {
    expect(instantFromDb('2026-11-17 17:00:00+00').toString()).toBe('2026-11-17T17:00:00Z');
    expect(instantFromDb('2026-11-17 17:00:00.123456+00').epochMilliseconds).toBe(
      at('2026-11-17T17:00:00.123Z').epochMilliseconds,
    );
    expect(instantFromDb('2026-11-17 22:30:00+05:30').toString()).toBe('2026-11-17T17:00:00Z');
  });

  it('lê e escreve timestamp sem fuso (hora combinada)', () => {
    expect(plainFromDb('2026-11-17 14:00:00').toString()).toBe('2026-11-17T14:00:00');
    expect(plainToDb(Temporal.PlainDateTime.from('2026-11-17T14:00'))).toBe('2026-11-17 14:00:00');
  });
});

describe('agrupamento por data de quem vê', () => {
  it('23h30 em Manaus cai no dia seguinte para quem está em São Paulo', () => {
    const slot = Temporal.PlainDateTime.from('2026-11-17T23:30').toZonedDateTime(MANAUS).toInstant();
    expect([...groupByViewerDate([slot], SP).keys()]).toEqual(['2026-11-18']);
    expect([...groupByViewerDate([slot], MANAUS).keys()]).toEqual(['2026-11-17']);
  });

  it('mantém a ordem dos horários dentro de cada dia', () => {
    const a = at('2026-11-17T18:00:00Z');
    const b = at('2026-11-17T17:00:00Z');
    expect(groupByViewerDate([a, b], SP).get('2026-11-17')!.map(String)).toEqual([b.toString(), a.toString()]);
  });
});

describe('texto para pessoas', () => {
  it('formata em português do Brasil, no fuso pedido', () => {
    expect(formatPtBr(at('2026-11-17T17:00:00Z'), SP)).toBe('terça-feira, 17 de novembro, 14:00');
  });

  it('cita os dois horários quando os fusos diferem', () => {
    const s = bothTimes(at('2026-11-17T17:00:00Z'), SP, MANAUS);
    expect(s).toContain('13:00');
    expect(s).toContain('Manaus');
    expect(s).toContain('14:00');
    expect(s).toContain('São Paulo');
  });

  it('cita um horário só quando coincidem', () => {
    expect(bothTimes(at('2026-11-17T17:00:00Z'), SP, SP)).toBe('terça-feira, 17 de novembro, 14:00');
  });
});
