import Link from 'next/link';
import { sql } from 'kysely';
import { appDeps } from '@/server/app';
import { requireStaff } from '@/server/session';

export const dynamic = 'force-dynamic';

const CARD = 'block rounded-3xl border border-site-line bg-white p-5 hover:border-indigo-300';

/** Início do painel da equipe: o que pede ação agora, com atalho para cada fila. */
export default async function StaffHome() {
  await requireStaff();
  const { rows } = await sql<{ pending_docs: number; in_review: number; releasing: number; unprocessed: number }>`
    SELECT (SELECT count(*)::int FROM teacher_verifications WHERE status = 'pending') AS pending_docs,
           (SELECT count(*)::int FROM teachers WHERE status = 'in_review') AS in_review,
           (SELECT count(*)::int FROM payouts WHERE status = 'releasing') AS releasing,
           (SELECT count(*)::int FROM webhook_events WHERE processed_at IS NULL) AS unprocessed`.execute(appDeps().db);
  const c = rows[0]!;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Painel interno</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/interno/verificacoes" className={CARD}>
          <p className="text-sm font-semibold text-site-muted">Verificações</p>
          <p className="mt-1 font-display text-xl font-bold">{c.pending_docs} documentos · {c.in_review} perfis em análise</p>
        </Link>
        <Link href="/interno/aulas" className={CARD}>
          <p className="text-sm font-semibold text-site-muted">Aulas e repasses</p>
          <p className="mt-1 font-display text-xl font-bold">{c.releasing} repasses em liberação</p>
          <p className="mt-1 text-sm text-site-muted">{c.unprocessed} avisos de pagamento não processados</p>
        </Link>
      </div>
    </div>
  );
}
