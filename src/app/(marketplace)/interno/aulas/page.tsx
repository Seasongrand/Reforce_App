import Link from 'next/link';
import { sql } from 'kysely';
import { ActionForm } from '@/components/ActionForm';
import { pendingDecisions } from '@/domain/lessons/close';
import { formatBRL } from '@/lib/money';
import { formatPtBr } from '@/time/zoned';
import { appDeps, now } from '@/server/app';
import { requireStaff } from '@/server/session';
import { decideOutcomeAction } from '../actions';

export const dynamic = 'force-dynamic';

const OUTCOMES = [
  ['taught', 'Aula dada'],
  ['student_no_show', 'Falta do aluno'],
  ['teacher_no_show', 'Falta do professor (reembolso)'],
] as const;

export default async function StaffLessons() {
  await requireStaff();
  const deps = appDeps();
  const at = await now();
  const pending = await pendingDecisions(deps.db, at, deps.config.teacherNoShowMinutes);
  const payouts = await sql<{ status: string; n: number; teacher_cents: number }>`
    SELECT status, count(*)::int AS n, coalesce(sum(teacher_cents), 0)::int AS teacher_cents
      FROM payouts GROUP BY status ORDER BY status`.execute(deps.db);
  return (
    <div className="space-y-6">
      <Link href="/interno" className="text-sm text-brand">← Painel</Link>
      <h1 className="text-2xl font-semibold">Aulas e repasses</h1>
      <section className="card space-y-3">
        <h2 className="font-medium">Aulas sem evidência</h2>
        {pending.length === 0 && <p className="text-sm text-slate-600">Nenhuma aula aguardando decisão.</p>}
        {pending.map((p) => (
          <div key={p.bookingId} className="space-y-2 border-t border-slate-100 pt-3">
            <p className="text-sm">
              <strong>{p.teacherName}</strong> com {p.studentFirstName}, {formatPtBr(p.startsAt, 'America/Sao_Paulo')} ({p.modality})
              <span className="block text-slate-600">{p.reason}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map(([value, label]) => (
                <ActionForm key={value} action={decideOutcomeAction} submitLabel={label} className="">
                  <input type="hidden" name="bookingId" value={p.bookingId} />
                  <input type="hidden" name="outcome" value={value} />
                </ActionForm>
              ))}
            </div>
          </div>
        ))}
      </section>
      <section className="card">
        <h2 className="mb-2 font-medium">Repasses</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-600"><th>Situação</th><th>Quantidade</th><th>Parte dos professores</th></tr></thead>
          <tbody>
            {payouts.rows.map((r) => (
              <tr key={r.status}><td>{r.status}</td><td>{r.n}</td><td>{formatBRL(r.teacher_cents)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
