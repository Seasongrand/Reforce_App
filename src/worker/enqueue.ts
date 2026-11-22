/**
 * Enfileira uma tarefa do Graphile Worker pela própria conexão da transação:
 * se a transação não gravar, a tarefa também não existe (§2.4).
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { Db } from '@/db/client';
import type { Transaction } from 'kysely';
import type { DB } from '@/db/types';

export type TaskName =
  | 'payment.refund'
  | 'video.create_room'
  | 'calendar.create_event'
  | 'calendar.delete_event'
  | 'search.refresh_teacher'
  | 'message.notify';

export async function enqueue(
  trx: Db | Transaction<DB>,
  task: TaskName,
  payload: Record<string, unknown>,
  opts: { jobKey?: string; runAt?: Temporal.Instant; maxAttempts?: number } = {},
): Promise<void> {
  await sql`SELECT graphile_worker.add_job(
              ${task},
              ${JSON.stringify(payload)}::json,
              run_at => ${opts.runAt?.toString() ?? null}::timestamptz,
              max_attempts => ${opts.maxAttempts ?? null}::int,
              job_key => ${opts.jobKey ?? null}::text)`.execute(trx);
}
