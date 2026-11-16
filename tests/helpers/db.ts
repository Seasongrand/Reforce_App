import pg from 'pg';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://aulas:aulas@localhost:5433/aulas_test';

let pool: pg.Pool | undefined;

/** Pool compartilhado pelos testes de um arquivo. */
export function testPool(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 30 });
  return pool;
}

export async function closeTestPool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

/** Conexão própria, para testes de concorrência. Quem abre fecha. */
export async function newClient(): Promise<pg.Client> {
  const c = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await c.connect();
  return c;
}

/** Esvazia todas as tabelas do esquema public, exceto o controle de migrações. */
export async function truncateAll(): Promise<void> {
  const { rows } = await testPool().query<{ t: string }>(
    `SELECT format('%I.%I', schemaname, tablename) AS t
       FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`,
  );
  if (rows.length === 0) return;
  await testPool().query(`TRUNCATE ${rows.map((r) => r.t).join(', ')} RESTART IDENTITY CASCADE`);
}
