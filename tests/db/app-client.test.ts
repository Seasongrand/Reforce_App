/**
 * O cliente de banco da aplicação devolve instantes e horas locais como texto,
 * para virar Temporal sem passar por Date.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { createDb } from '@/db/client';
import { instantFromDb } from '@/time/zoned';
import { TEST_DATABASE_URL } from '../helpers/db';

const { db, destroy } = createDb(TEST_DATABASE_URL);
afterAll(destroy);

describe('cliente de banco da aplicação', () => {
  it('timestamptz e timestamp chegam como texto', async () => {
    const r = await sql<{ i: unknown; l: unknown; d: unknown }>`
      SELECT timestamptz '2026-11-17 14:00-03' AS i, timestamp '2026-11-17 14:00' AS l, date '2026-11-17' AS d`.execute(db);
    const row = r.rows[0]!;
    expect(typeof row.i).toBe('string');
    expect(instantFromDb(row.i as string).toString()).toBe('2026-11-17T17:00:00Z');
    expect(row.l).toBe('2026-11-17 14:00:00');
    expect(row.d).toBe('2026-11-17');
  });

  it('a sessão do banco roda em UTC', async () => {
    const r = await sql<{ tz: string }>`SELECT current_setting('TimeZone') AS tz`.execute(db);
    expect(r.rows[0]!.tz).toBe('UTC');
  });
});
