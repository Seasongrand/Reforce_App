/**
 * Processo worker: fila e tarefas agendadas no próprio PostgreSQL
 * (Graphile Worker). Rode com `npm run worker`.
 */
import 'dotenv/config';
import { run } from 'graphile-worker';
import { config } from '@/config';
import { getDb } from '@/db/client';
import { providers } from '@/providers';
import { DailyVideoProvider } from '@/providers/video/daily';
import { getClock } from '@/time/dev-clock';
import { buildTaskList, CRONTAB } from './tasks';

async function main() {
  const cfg = config();
  const db = getDb();
  const deps = { db, config: cfg, providers: providers(db, cfg) };
  const runner = await run({
    connectionString: cfg.databaseUrl,
    concurrency: 5,
    taskList: buildTaskList(() => deps, () => getClock(db, { devTools: cfg.devTools })),
    crontab: CRONTAB,
  });
  console.log(`worker rodando (adaptadores: ${JSON.stringify(cfg.providers)})`);
  // Daily: o webhook de presença é cadastrado uma vez; se falhar, tenta de novo no próximo início
  if (deps.providers.video instanceof DailyVideoProvider) {
    deps.providers.video.ensureWebhook(`${cfg.appBaseUrl}/api/webhooks/video`)
      .then((r) => console.log(`[daily] webhook de presença: ${r === 'created' ? 'cadastrado' : 'já existia'}`))
      .catch((err) => console.error('[daily] não consegui cadastrar o webhook de presença:', (err as Error).message));
  }
  await runner.promise;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
