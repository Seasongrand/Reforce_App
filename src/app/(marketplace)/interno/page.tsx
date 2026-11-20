import Link from 'next/link';
import { sql } from 'kysely';
import { appDeps } from '@/server/app';
import { requireStaff } from '@/server/session';
import { logoutAction } from './entrar/actions';

export const dynamic = 'force-dynamic';

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Painel interno</h1>
        <form action={logoutAction}><button className="btn-secondary">Sair</button></form>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/interno/verificacoes" className="card block hover:border-brand">
          <p className="text-sm text-slate-600">Verificações</p>
          <p className="text-lg font-semibold">{c.pending_docs} documentos · {c.in_review} perfis em análise</p>
        </Link>
        <Link href="/interno/aulas" className="card block hover:border-brand">
          <p className="text-sm text-slate-600">Aulas e repasses</p>
          <p className="text-lg font-semibold">{c.releasing} repasses em liberação · {c.unprocessed} avisos de pagamento não processados</p>
        </Link>
      </div>
    </div>
  );
}
