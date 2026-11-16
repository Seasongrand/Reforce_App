/**
 * Fonte única do "agora" das regras de negócio. Toda consulta que compara com
 * o tempo recebe este instante como parâmetro, em vez de usar now() no banco.
 */
import { Temporal } from 'temporal-polyfill';

export interface Clock {
  now(): Temporal.Instant;
}

export const systemClock: Clock = {
  now: () => Temporal.Now.instant(),
};

export interface FixedClock extends Clock {
  set(instant: Temporal.Instant | string): void;
  advance(d: Temporal.DurationLike): void;
}

/** Relógio parado, para testes. */
export function fixedClock(start: Temporal.Instant | string): FixedClock {
  let current = Temporal.Instant.from(start);
  return {
    now: () => current,
    set: (i) => {
      current = Temporal.Instant.from(i);
    },
    advance: (d) => {
      current = current.add(d);
    },
  };
}
