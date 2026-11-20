import { sql } from 'kysely';
import { ActionForm } from '@/components/ActionForm';
import { pendingDecisions } from '@/domain/lessons/close';
import { lessonsOfDay } from '@/domain/staff/lists';
import { formatBRL } from '@/lib/money';
import { formatPtBr, formatTime } from '@/time/zoned';
import { appDeps, now } from '@/server/app';
import { requireStaff } from '@/server/session';
import { decideOutcomeAction } from '../../actions';

export const dynamic = 'force-dynamic';

const OUTCOMES = [
  ['taught', 'Aula dada'],
  ['student_no_show', 'Falta do aluno'],
  ['teacher_no_show', 'Falta do professor (reembolso)'],
] as const;

const PAYOUT_STATUS: Record<string, string> = {
  held: 'Retido', releasing: 'Em liberação', released: 'Liberado', refunded: 'Devolvido',
};
const CARD = 'rounded-3xl border border-site-line bg-white p-5';
const LESSON_STATUS: Record<string, string> = {
  confirmed: 'Confirmada', completed: 'Concluída', no_show: 'Aluno faltou', cancelled: 'Cancelada',
};
const SP = 'America/Sao_Paulo';
const MODALITY: Record<string, string> = {
  online: 'online', at_student: 'na casa do aluno', at_teacher: 'no endereço do professor',
};

export default async function StaffLessons() {
  await requireStaff();
  const deps = appDeps();
  const at = await now();
  const today = await lessonsOfDay(deps.db, at, SP);
  const pending = await pendingDecisions(deps.db, at, deps.config.teacherNoShowMinutes);
  const payouts = await sql<{ status: string; n: number; teacher_cents: number }>`
    SELECT status, count(*)::int AS n, coalesce(sum(teacher_cents), 0)::int AS teacher_cents
      FROM payouts GROUP BY status ORDER BY status`.execute(deps.db);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Aulas e repasses</h1>
      <section className={`${CARD} space-y-3`} aria-labelledby="hoje">
        <h2 id="hoje" className="font-display text-xl font-bold">Aulas de hoje <span className="text-base font-semibold text-site-muted">· {today.length}</span></h2>
        {today.length === 0 ? <p className="text-sm text-site-muted">Nenhuma aula hoje.</p> : (
          <ul className="divide-y divide-site-line">
            {today.map((l) => (
              <li key={l.bookingId} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5" data-testid={`hoje-${l.bookingId}`}>
                <span className="font-display text-lg font-bold">{formatTime(l.startsAt, SP)}</span>
                <span className="min-w-0 flex-1">
                  <strong>{l.teacherName}</strong> com {l.studentFirstName} · {l.subject} {MODALITY[l.modality] ?? l.modality}
                  {l.checkedIn && <span className="text-site-muted"> · presença registrada</span>}
                </span>
                <span className="text-sm font-semibold text-site-muted">{LESSON_STATUS[l.status] ?? l.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={`${CARD} space-y-3`}>
        <h2 className="font-display text-xl font-bold">Aulas sem evidência</h2>
        {pending.length === 0 && <p className="text-sm text-site-muted">Nenhuma aula aguardando decisão.</p>}
        {pending.map((p) => (
          <div key={p.bookingId} className="space-y-2 border-t border-site-line pt-3">
            <p className="text-sm">
              <strong>{p.teacherName}</strong> com {p.studentFirstName}, {formatPtBr(p.startsAt, SP)} ({MODALITY[p.modality] ?? p.modality})
              <span className="block text-site-muted">{p.reason}</span>
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
      <section className={CARD}>
        <h2 className="mb-3 font-display text-xl font-bold">Repasses</h2>
        {payouts.rows.length === 0 ? <p className="text-sm text-site-muted">Nenhum repasse ainda.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-site-muted"><th className="pb-2 font-semibold">Situação</th><th className="pb-2 font-semibold">Quantidade</th><th className="pb-2 font-semibold">Parte dos professores</th></tr></thead>
            <tbody>
              {payouts.rows.map((r) => (
                <tr key={r.status} className="border-t border-site-line"><td className="py-2">{PAYOUT_STATUS[r.status] ?? r.status}</td><td className="py-2">{r.n}</td><td className="py-2">{formatBRL(r.teacher_cents)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
