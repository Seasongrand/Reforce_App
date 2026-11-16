/**
 * Acesso ao banco da aplicação: Kysely sobre um pool do pg.
 * Instantes (timestamptz), horas locais (timestamp) e datas chegam como texto
 * e viram Temporal em src/time/zoned.ts; nada de Date em regra de negócio.
 * A sessão roda em UTC para que nenhuma conversão dependa do fuso do servidor.
 */
import pg from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import type { DB } from './types';
import { config } from '@/config';

const TEXT_OIDS = new Set([
  1082, // date
  1114, // timestamp
  1184, // timestamptz
]);

const types = {
  getTypeParser(oid: number, format?: 'text' | 'binary') {
    if (TEXT_OIDS.has(oid)) return (v: string) => v;
    return pg.types.getTypeParser(oid, format as 'text');
  },
};

export type Db = Kysely<DB>;

export function createDb(connectionString: string, opts: { max?: number } = {}) {
  const pool = new pg.Pool({
    connectionString,
    max: opts.max ?? 10,
    types,
    options: '-c TimeZone=UTC',
  });
  const db = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
  return { db, pool, destroy: () => db.destroy() };
}

let shared: ReturnType<typeof createDb> | undefined;

/** Banco do processo (web ou worker), criado na primeira chamada. */
export function getDb(): Db {
  shared ??= createDb(config().databaseUrl);
  return shared.db;
}
