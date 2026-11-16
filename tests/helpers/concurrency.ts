import type pg from 'pg';
import { newClient } from './db';

export type Settled<T> = { ok: true; value: T } | { ok: false; code?: string; message: string };

/**
 * Roda `fn` em `n` conexões próprias, ao mesmo tempo. Todas as conexões são
 * abertas antes; cada função recebe `ready()`, uma barreira que só libera
 * quando as `n` funções chegaram nela. Use-a logo antes da operação disputada.
 */
export async function raceN<T>(
  n: number,
  fn: (client: pg.Client, i: number, ready: () => Promise<void>) => Promise<T>,
): Promise<Settled<T>[]> {
  const clients = await Promise.all(Array.from({ length: n }, () => newClient()));
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const ready = async () => {
    arrived += 1;
    if (arrived === n) release();
    await gate;
  };
  try {
    return await Promise.all(
      clients.map(async (c, i): Promise<Settled<T>> => {
        try {
          return { ok: true, value: await fn(c, i, ready) };
        } catch (err) {
          await c.query('ROLLBACK').catch(() => {});
          const e = err as { code?: string; message: string };
          return { ok: false, code: e.code, message: e.message };
        }
      }),
    );
  } finally {
    await Promise.all(clients.map((c) => c.end()));
  }
}
