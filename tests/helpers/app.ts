/** Banco da aplicação (Kysely) apontando para o banco de teste. */
import { createDb, type Db } from '@/db/client';
import { loadConfig, type AppConfig } from '@/config';
import { TEST_DATABASE_URL } from './db';

let shared: ReturnType<typeof createDb> | undefined;

export function appDb(): Db {
  shared ??= createDb(TEST_DATABASE_URL, { max: 30 });
  return shared.db;
}

export async function closeAppDb(): Promise<void> {
  await shared?.destroy();
  shared = undefined;
}

export const TEST_FILE_KEY = 'a'.repeat(64);

export function testConfig(over: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    APP_BASE_URL: 'http://localhost:3000',
    SESSION_SECRET: 's'.repeat(32),
    FILE_ENCRYPTION_KEY: TEST_FILE_KEY,
    FILE_STORAGE_DIR: 'var/test-private',
    ...over,
  });
}
