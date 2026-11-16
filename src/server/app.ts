/**
 * Dependências e relógio do processo web, montados uma vez. Todo código de
 * tela e de rota pega daqui o que precisa; a lógica fica em src/domain.
 */
import 'server-only';
import { config } from '@/config';
import { getDb } from '@/db/client';
import type { Deps } from '@/domain/deps';
import type { WaitlistDeps } from '@/domain/waitlist';
import { providers } from '@/providers';
import { getClock } from '@/time/dev-clock';
import type { Temporal } from 'temporal-polyfill';

let deps: Deps | undefined;

/** Dependências do marketplace. No modo lista de espera, o marketplace está desligado. */
export function appDeps(): Deps {
  if (!deps) {
    const cfg = config();
    if (cfg.siteMode !== 'completo') throw new Error('marketplace desligado: SITE_MODE=lista_de_espera');
    const db = getDb();
    deps = { db, config: cfg, providers: providers(db, cfg) };
  }
  return deps;
}

/** O que a lista de espera precisa: banco e configuração, sem provedores. */
export function siteDeps(): WaitlistDeps {
  return { db: getDb(), config: config() };
}

/** "Agora" das regras de negócio (relógio ajustável em /dev, com DEV_TOOLS=1). */
export async function now(): Promise<Temporal.Instant> {
  return (await getClock(getDb(), { devTools: config().devTools })).now();
}
