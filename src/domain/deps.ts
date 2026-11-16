import type { AppConfig } from '@/config';
import type { Db } from '@/db/client';
import type { Providers } from '@/providers';

/** O que os serviços de domínio recebem. O "agora" vem à parte, do relógio. */
export interface Deps {
  db: Db;
  config: AppConfig;
  providers: Providers;
}
