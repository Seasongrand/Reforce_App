import pg from 'pg';
import { migrate } from '../../scripts/migrate';
import { TEST_DATABASE_URL } from './db';

/** Recria o banco de teste do zero e aplica todas as migrações. */
export default async function setup(): Promise<void> {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  const admin = new URL(TEST_DATABASE_URL);
  admin.pathname = '/postgres';
  const c = new pg.Client({ connectionString: admin.toString() });
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS ${pg.escapeIdentifier(dbName)} WITH (FORCE)`);
  await c.query(`CREATE DATABASE ${pg.escapeIdentifier(dbName)}`);
  await c.end();
  await migrate(TEST_DATABASE_URL, { quiet: true });
}
