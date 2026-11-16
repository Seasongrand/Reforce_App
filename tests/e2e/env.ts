/** Ambiente isolado do teste de ponta a ponta: banco, porta e segredos próprios. */
export const E2E_PORT = 3200;
export const E2E_BASE = `http://localhost:${E2E_PORT}`;
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgres://aulas:aulas@localhost:5433/aulas_e2e';
export const STAFF_EMAIL = 'equipe-e2e@exemplo.com';

export const E2E_ENV: Record<string, string> = {
  DATABASE_URL: E2E_DATABASE_URL,
  APP_BASE_URL: E2E_BASE,
  DEV_TOOLS: '1',
  SESSION_SECRET: 'segredo-do-teste-de-ponta-a-ponta-com-mais-de-32',
  FILE_ENCRYPTION_KEY: 'b'.repeat(64),
  FILE_STORAGE_DIR: 'var/e2e-private',
  ADMIN_EMAILS: STAFF_EMAIL,
  NEXT_TELEMETRY_DISABLED: '1',
};
