import { afterAll, describe, expect, it } from 'vitest';
import { migrate } from '../../scripts/migrate';
import { closeTestPool, testPool, TEST_DATABASE_URL } from '../helpers/db';

afterAll(closeTestPool);

describe('fundação do banco', () => {
  it('migrações criam as quatro extensões em PostgreSQL 16+', async () => {
    const { rows } = await testPool().query<{ extname: string }>('SELECT extname FROM pg_extension');
    const names = rows.map((r) => r.extname);
    expect(names).toEqual(expect.arrayContaining(['btree_gist', 'unaccent', 'cube', 'earthdistance']));
    const v = await testPool().query<{ server_version_num: string }>('SHOW server_version_num');
    expect(Number(v.rows[0]!.server_version_num)).toBeGreaterThanOrEqual(160000);
  });

  it('rodar as migrações de novo não reaplica nada', async () => {
    const applied = await migrate(TEST_DATABASE_URL, { quiet: true });
    expect(applied).toEqual([]);
  });

  it('instala o esquema do Graphile Worker', async () => {
    const { rows } = await testPool().query(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name = 'graphile_worker'`,
    );
    expect(rows).toHaveLength(1);
  });
});
