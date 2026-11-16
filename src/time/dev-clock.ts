/**
 * Relógio de desenvolvimento: com DEV_TOOLS=1, o "agora" é o relógio do
 * sistema mais um deslocamento guardado em dev_clock, compartilhado por web e
 * worker. Serve para simular a passagem do tempo no fluxo de ponta a ponta.
 */
import { sql } from 'kysely';
import { Temporal } from 'temporal-polyfill';
import type { Db } from '@/db/client';
import { systemClock, type Clock } from './clock';

export async function getClock(db: Db, opts: { devTools: boolean }): Promise<Clock> {
  if (!opts.devTools) return systemClock;
  const { rows } = await sql<{ offset_ms: string }>`SELECT offset_ms::text FROM dev_clock`.execute(db);
  const offset = Number(rows[0]?.offset_ms ?? 0);
  if (offset === 0) return systemClock;
  return { now: () => Temporal.Now.instant().add({ milliseconds: offset }) };
}

export async function setDevClockOffset(db: Db, d: Temporal.DurationLike): Promise<void> {
  const ms = Math.round(Temporal.Duration.from(d).total({ unit: 'milliseconds' }));
  await sql`INSERT INTO dev_clock (id, offset_ms) VALUES (true, ${ms})
            ON CONFLICT (id) DO UPDATE SET offset_ms = EXCLUDED.offset_ms`.execute(db);
}

/** Avança o relógio de desenvolvimento a partir do deslocamento atual. */
export async function advanceDevClock(db: Db, d: Temporal.DurationLike): Promise<void> {
  const ms = Math.round(Temporal.Duration.from(d).total({ unit: 'milliseconds' }));
  await sql`INSERT INTO dev_clock (id, offset_ms) VALUES (true, ${ms})
            ON CONFLICT (id) DO UPDATE SET offset_ms = dev_clock.offset_ms + EXCLUDED.offset_ms`.execute(db);
}
