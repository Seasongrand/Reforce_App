/**
 * Banco de ponta a ponta recriado do zero, migrado e com carga inicial; o
 * worker real roda junto, como em produção.
 */
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import pg from 'pg';
import { migrate } from '../../scripts/migrate';
import { seed } from '../../scripts/seed';
import { E2E_DATABASE_URL, E2E_ENV } from './env';

export default async function globalSetup() {
  const url = new URL(E2E_DATABASE_URL);
  const admin = new URL(E2E_DATABASE_URL);
  admin.pathname = '/postgres';
  const c = new pg.Client({ connectionString: admin.toString() });
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS ${pg.escapeIdentifier(url.pathname.slice(1))} WITH (FORCE)`);
  await c.query(`CREATE DATABASE ${pg.escapeIdentifier(url.pathname.slice(1))}`);
  await c.end();
  await migrate(E2E_DATABASE_URL, { quiet: true });
  await seed(E2E_DATABASE_URL, { adminEmails: E2E_ENV.ADMIN_EMAILS });
  await rm('var/e2e-private', { recursive: true, force: true });

  const worker = spawn('npx', ['tsx', 'src/worker/index.ts'], {
    env: { ...process.env, ...E2E_ENV },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('worker não subiu em 60 s')), 60_000);
    worker.stdout!.on('data', (d: Buffer) => {
      if (d.toString().includes('worker rodando')) {
        clearTimeout(timer);
        resolve();
      }
    });
    worker.on('exit', (code) => reject(new Error(`worker saiu com código ${code}`)));
  });
  return async () => {
    try {
      process.kill(-worker.pid!, 'SIGTERM');
    } catch {
      /* já saiu */
    }
  };
}
