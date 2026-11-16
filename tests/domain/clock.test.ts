import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { fixedClock, systemClock } from '@/time/clock';

describe('relógio', () => {
  it('relógio do sistema acompanha o tempo real', () => {
    const before = Temporal.Now.instant();
    const now = systemClock.now();
    expect(Temporal.Instant.compare(now, before)).toBeGreaterThanOrEqual(0);
  });

  it('relógio fixo devolve o instante dado e pode avançar', () => {
    const clock = fixedClock('2026-11-17T17:00:00Z');
    expect(clock.now().toString()).toBe('2026-11-17T17:00:00Z');
    clock.advance({ minutes: 90 });
    expect(clock.now().toString()).toBe('2026-11-17T18:30:00Z');
    clock.set('2026-11-20T12:00:00Z');
    expect(clock.now().toString()).toBe('2026-11-20T12:00:00Z');
  });
});
