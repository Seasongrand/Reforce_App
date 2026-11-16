/**
 * Teste no navegador do site em modo lista de espera (SITE_MODE=lista_de_espera),
 * com servidor e banco próprios. Roda depois do fluxo completo, nunca junto:
 * dois `next dev` no mesmo diretório não convivem.
 */
import { defineConfig } from '@playwright/test';
import { LISTA_BASE, LISTA_ENV, LISTA_PORT } from './tests/e2e-lista/env';

export default defineConfig({
  testDir: 'tests/e2e-lista',
  timeout: 3 * 60_000,
  expect: { timeout: 30_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  globalSetup: './tests/e2e-lista/global-setup.ts',
  use: {
    baseURL: LISTA_BASE,
    trace: 'off',
    navigationTimeout: 90_000,
    actionTimeout: 30_000,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  webServer: {
    command: `npx next dev -p ${LISTA_PORT}`,
    url: `${LISTA_BASE}/privacidade`, // não depende do banco: o servidor sobe antes do globalSetup
    env: LISTA_ENV,
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
