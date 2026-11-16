import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: process.env.PERF ? ['node_modules/**'] : ['tests/**/*.perf.test.ts', 'node_modules/**'],
    globalSetup: ['tests/helpers/global-setup.ts'],
    fileParallelism: false,
    isolate: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
