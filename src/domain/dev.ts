import type { AppConfig } from '@/config';

/** /dev e as rotas de simulação só existem em desenvolvimento, com adaptadores falsos. */
export function devToolsEnabled(cfg: AppConfig): boolean {
  return cfg.devTools && cfg.nodeEnv !== 'production' && cfg.providers.payment === 'fake' && cfg.providers.video === 'fake';
}
