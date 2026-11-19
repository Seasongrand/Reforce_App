/** Ambiente do teste no navegador em modo lista de espera: porta e banco próprios. */
import { E2E_DATABASE_URL } from '../e2e/env';

export const LISTA_PORT = 3201;
export const LISTA_BASE = `http://localhost:${LISTA_PORT}`;
export const LISTA_PASSWORD = 'senha-de-teste-bem-longa';

const db = new URL(E2E_DATABASE_URL);
db.pathname = '/aulas_e2e_lista';
export const LISTA_DATABASE_URL = db.toString();

export const LISTA_ENV: Record<string, string> = {
  DATABASE_URL: LISTA_DATABASE_URL,
  APP_BASE_URL: LISTA_BASE,
  SITE_MODE: 'lista_de_espera',
  WAITLIST_EXPORT_PASSWORD: LISTA_PASSWORD,
  // com as duas chaves, a equipe (com a senha) usa as áreas fechadas ao público
  SESSION_SECRET: 'segredo-do-teste-da-lista-de-espera-com-mais-de-32',
  FILE_ENCRYPTION_KEY: 'c'.repeat(64),
  FILE_STORAGE_DIR: 'var/e2e-lista-private',
  NEXT_TELEMETRY_DISABLED: '1',
};
