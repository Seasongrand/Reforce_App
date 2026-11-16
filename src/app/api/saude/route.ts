import { sql } from 'kysely';
import { getDb } from '@/db/client';

export const dynamic = 'force-dynamic';

/** Checagem de saúde para a hospedagem: o processo responde e o banco também. */
export async function GET() {
  try {
    await sql`SELECT 1`.execute(getDb());
    return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
