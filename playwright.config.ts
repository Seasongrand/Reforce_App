import { defineConfig } from '@playwright/test';
import { E2E_BASE, E2E_ENV, E2E_PORT } from './tests/e2e/env';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 8 * 60_000,
  expect: { timeout: 30_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: E2E_BASE,
    trace: 'off',
    navigationTimeout: 90_000,
    actionTimeout: 30_000,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  webServer: {
    command: `npx next dev -p ${E2E_PORT}`,
    url: `${E2E_BASE}/professor/entrar`,
    env: E2E_ENV,
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
