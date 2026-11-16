import { sql } from 'kysely';
import type { Db } from '@/db/client';

/** Registra uma chamada recebida por um provedor falso (tabela dev_provider_calls). */
export async function recordCall(db: Db, provider: string, operation: string, ref: string, payload: unknown = null) {
  await sql`INSERT INTO dev_provider_calls (provider, operation, ref, payload)
            VALUES (${provider}, ${operation}, ${ref}, ${JSON.stringify(payload)}::jsonb)`.execute(db);
}
