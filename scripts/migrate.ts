/**
 * Executor de migrações em SQL puro.
 * Aplica db/migrations/*.sql em ordem de nome, cada arquivo numa transação,
 * sob uma trava consultiva para que dois processos não migrem ao mesmo tempo.
 * Depois instala (ou atualiza) o esquema do Graphile Worker.
 */
import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { runMigrations } from 'graphile-worker';

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../db/migrations');
const LOCK_KEY = 'aulas:schema_migrations';

export async function migrate(databaseUrl: string, opts: { quiet?: boolean } = {}): Promise<string[]> {
  const log = (msg: string) => { if (!opts.quiet) console.log(msg); };
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [LOCK_KEY]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const done = new Set(
      (await client.query<{ version: string }>('SELECT version FROM schema_migrations')).rows.map((r) => r.version),
    );
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      if (done.has(version)) continue;
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`migração ${file} falhou: ${(err as Error).message}`, { cause: err });
      }
      applied.push(version);
      log(`aplicada ${version}`);
    }
    await runMigrations({ connectionString: databaseUrl, logger: undefined });
    if (applied.length === 0) log('nada a aplicar');
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_KEY]).catch(() => {});
    await client.end();
  }
  return applied;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL não definida (veja .env.example)');
    process.exit(1);
  }
  migrate(url).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
