import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Temporal } from 'temporal-polyfill';
import { PrintButton } from '@/components/panel/PrintButton';
import { orderReceipt } from '@/domain/guardians/receipt';
import { formatBRL } from '@/lib/money';
import { formatPtBr } from '@/time/zoned';
import { appDeps } from '@/server/app';
import { requireGuardian } from '@/server/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Comprovante · Minha conta · Reforce' };

const METHOD = { pix: 'PIX', card: 'Cartão' } as const;
const PLACE: Record<string, string> = { online: 'online', at_student: 'na casa do aluno', at_teacher: 'no endereço do professor' };
const STATUS: Record<string, string> = {
  confirmed: 'Marcada', completed: 'Concluída', no_show: 'Falta do aluno', cancelled: 'Cancelada', expired: 'Expirada',
};

/** Comprovante do pagamento de um pedido, para imprimir ou salvar em PDF. Não é nota fiscal. */
export default async function ReceiptPage({ params }: { params: Promise<{ order: string }> }) {
  const guardianId = await requireGuardian();
  const { order } = await params;
  const deps = appDeps();
  const r = await orderReceipt(deps.db, guardianId, order);
  if (!r) notFound();
  const g = await deps.db.selectFrom('guardians').select('timezone').where('id', '=', guardianId).executeTakeFirst();
  const tz = g?.timezone ?? 'America/Sao_Paulo';
  const at = (iso: string) => formatPtBr(Temporal.Instant.from(iso), tz);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/conta/aulas" className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-600">← Aulas</Link>
        <PrintButton />
      </div>
      <article className="space-y-6 rounded-[20px] border border-site-line bg-white p-6 print:border-0 print:p-0" data-testid="comprovante">
        <header className="space-y-1">
          <p className="font-display text-2xl tracking-tight">Reforce</p>
          <h1 className="font-display text-3xl font-normal tracking-tight">Comprovante de pagamento</h1>
          <p className="text-sm text-site-muted">Pedido {r.number} · Este comprovante não é nota fiscal.</p>
        </header>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <div><dt className="text-sm text-site-muted">Pago por</dt><dd className="font-medium">{r.guardianName}</dd></div>
          <div><dt className="text-sm text-site-muted">Professor</dt><dd className="font-medium">{r.teacherName}</dd></div>
          <div><dt className="text-sm text-site-muted">Data do pagamento</dt><dd className="font-medium">{at(r.paidAt)}</dd></div>
          <div><dt className="text-sm text-site-muted">Forma de pagamento</dt><dd className="font-medium">{METHOD[r.method]}</dd></div>
          <div><dt className="text-sm text-site-muted">Valor pago</dt><dd className="font-display text-2xl tracking-tight">{formatBRL(r.amountCents)}</dd></div>
          {r.refundedCents > 0 && (
            <div><dt className="text-sm text-site-muted">Devolvido</dt><dd className="font-display text-2xl tracking-tight" data-testid="devolvido">{formatBRL(r.refundedCents)}</dd></div>
          )}
        </dl>
        <section className="space-y-2">
          <h2 className="font-medium">{r.lessons.length === 1 ? 'Aula' : 'Aulas'}</h2>
          <ul className="divide-y divide-site-line rounded-lg border border-site-line">
            {r.lessons.map((l) => (
              <li key={l.startsAt} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-[15px]">
                <span>{l.subject} · {l.studentFirstName} · {at(l.startsAt)} · {l.durationMin} min, {PLACE[l.modality]}</span>
                <span className="text-sm text-site-muted">{STATUS[l.status] ?? l.status}</span>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </div>
  );
}
