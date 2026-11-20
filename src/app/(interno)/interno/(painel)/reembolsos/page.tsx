import { refundList, type RefundItem, type RefundReason } from '@/domain/staff/lists';
import { formatBRL } from '@/lib/money';
import { formatPtBr } from '@/time/zoned';
import { appDeps } from '@/server/app';
import { requireStaff } from '@/server/session';

export const dynamic = 'force-dynamic';

const REASON: Record<RefundReason, string> = {
  teacher_no_show: 'Falta do professor',
  student_excused: 'Falta justificada do aluno',
  student_no_show: 'Falta do aluno (devolve a parte que não fica com o professor)',
  late_payment: 'Pagamento depois do prazo',
};
const CARD = 'rounded-3xl border border-site-line bg-white p-5';

function refundState(r: RefundItem): { label: string; tone: string } {
  if (r.refundedCents === 0) return { label: 'Aguardando o provedor', tone: 'bg-amber-50 text-amber-900' };
  if (r.refundedCents >= r.amountCents) return { label: `Devolvido ${formatBRL(r.refundedCents)}`, tone: 'bg-emerald-50 text-emerald-900' };
  return { label: `Devolvido ${formatBRL(r.refundedCents)} de ${formatBRL(r.amountCents)}`, tone: 'bg-emerald-50 text-emerald-900' };
}

/** Reembolsos: pedidos com devolução decidida, o motivo e se o provedor já devolveu. */
export default async function StaffRefunds() {
  await requireStaff();
  const list = await refundList(appDeps().db);
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl font-bold">Reembolsos</h1>
        <p className="text-site-muted">As devoluções são automáticas. “Aguardando o provedor” por mais de um dia pede uma olhada no provedor de pagamento.</p>
      </div>
      {list.length === 0 ? (
        <p className={`${CARD} text-site-muted`}>Nenhum reembolso ainda.</p>
      ) : (
        <ul className={`${CARD} divide-y divide-site-line py-1`}>
          {list.map((r) => {
            const state = refundState(r);
            return (
              <li key={r.orderId} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3.5" data-testid={`reembolso-${r.orderId}`}>
                <div className="min-w-0">
                  <p className="font-semibold [overflow-wrap:anywhere]">{r.guardianName} · aula com {r.teacherName}</p>
                  <p className="text-sm text-site-muted">Pago em {formatPtBr(r.paidAt, 'America/Sao_Paulo')} · {formatBRL(r.amountCents)}</p>
                  <p className="text-sm">{REASON[r.reason]}</p>
                </div>
                <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${state.tone}`}>{state.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
