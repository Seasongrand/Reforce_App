/** Banco do teste em modo lista de espera, recriado do zero, migrado e com carga inicial. */
import pg from 'pg';
import { migrate } from '../../scripts/migrate';
import { seed } from '../../scripts/seed';
import { LISTA_DATABASE_URL } from './env';

export default async function globalSetup() {
  const name = new URL(LISTA_DATABASE_URL).pathname.slice(1);
  const admin = new URL(LISTA_DATABASE_URL);
  admin.pathname = '/postgres';
  const c = new pg.Client({ connectionString: admin.toString() });
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS ${pg.escapeIdentifier(name)} WITH (FORCE)`);
  await c.query(`CREATE DATABASE ${pg.escapeIdentifier(name)}`);
  await c.end();
  await migrate(LISTA_DATABASE_URL, { quiet: true });
  await seed(LISTA_DATABASE_URL, { adminEmails: '' });
}
