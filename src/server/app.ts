/**
 * Dependências e relógio do processo web, montados uma vez. Todo código de
 * tela e de rota pega daqui o que precisa; a lógica fica em src/domain.
 */
import 'server-only';
import { config } from '@/config';
import { getDb } from '@/db/client';
import type { Deps } from '@/domain/deps';
import { providers } from '@/providers';
import { getClock } from '@/time/dev-clock';
import type { Temporal } from 'temporal-polyfill';

let deps: Deps | undefined;

export function appDeps(): Deps {
  if (!deps) {
    const cfg = config();
    const db = getDb();
    deps = { db, config: cfg, providers: providers(db, cfg) };
  }
  return deps;
}

/** "Agora" das regras de negócio (relógio ajustável em /dev, com DEV_TOOLS=1). */
export async function now(): Promise<Temporal.Instant> {
  const d = appDeps();
  return (await getClock(d.db, { devTools: d.config.devTools })).now();
}
