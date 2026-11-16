import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { Temporal } from 'temporal-polyfill';
import { ActionForm } from '@/components/ActionForm';
import { Countdown } from '@/components/Countdown';
import { OrderPoller } from '@/components/OrderPoller';
import { orderView } from '@/domain/public/order';
import { devToolsEnabled } from '@/domain/dev';
import { formatBRL } from '@/lib/money';
import { bothTimes, formatTime } from '@/time/zoned';
import { appDeps, now } from '@/server/app';
import { currentSubject } from '@/server/session';
import { startPaymentAction } from './actions';

export const dynamic = 'force-dynamic';

const MODALITY: Record<string, string> = { online: 'online', at_teacher: 'no endereço do professor', at_student: 'na sua casa' };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guardianId = await currentSubject('guardian');
  if (!guardianId) notFound();
  const deps = appDeps();
  const v = await orderView(deps, id, guardianId, await now());
  if (!v) notFound();
  if (v.status === 'paid') redirect(`/pedido/${id}/confirmado`);
  const starts = Temporal.Instant.from(v.startsAt);
  const pending = v.payment?.status === 'pending' ? v.payment : null;
  const qr = pending?.pixPayload ? await QRCode.toDataURL(pending.pixPayload, { margin: 1, width: 240 }) : null;
  let devChargeId: string | null = null;
  if (devToolsEnabled(deps.config) && pending) {
    devChargeId = (await deps.db.selectFrom('payments').select('provider_charge_id').where('order_id', '=', id)
      .where('status', '=', 'pending').executeTakeFirst())?.provider_charge_id ?? null;
  }
  const holding = v.status === 'awaiting_payment' && v.bookingStatus === 'held' && v.holdExpiresAt
    && Temporal.Instant.compare(Temporal.Instant.from(v.holdExpiresAt), await now()) > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Pagamento da aula</h1>
      <div className="card text-sm" data-testid="resumo-pedido">
        <p><strong>{v.subject}</strong> com {v.teacherName}, {MODALITY[v.modality]}, {v.durationMin} minutos</p>
        <p>{bothTimes(starts, v.teacherTimezone, v.guardianTimezone)}</p>
        <p className="text-lg font-semibold">{formatBRL(v.totalCents)}</p>
      </div>
      <OrderPoller orderId={id} status={v.status} />
      {holding ? (
        <>
          <Countdown until={v.holdExpiresAt!} />
          {!pending && (
            <div className="grid gap-3 sm:grid-cols-2">
              <ActionForm action={startPaymentAction} submitLabel="Pagar com PIX" className="card">
                <input type="hidden" name="orderId" value={id} /><input type="hidden" name="method" value="pix" />
              </ActionForm>
              <ActionForm action={startPaymentAction} submitLabel="Pagar com cartão" className="card">
                <input type="hidden" name="orderId" value={id} /><input type="hidden" name="method" value="card" />
              </ActionForm>
            </div>
          )}
          {pending?.method === 'pix' && qr && (
            <section className="card space-y-3 text-center" data-testid="pix">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR do PIX" className="mx-auto" width={240} height={240} />
              <p className="text-xs text-slate-600">PIX copia e cola:</p>
              <code className="block break-all rounded bg-slate-100 p-2 text-xs">{pending.pixPayload}</code>
              {pending.expiresAt && (
                <p className="text-xs text-slate-600">O QR vale até {formatTime(Temporal.Instant.from(pending.expiresAt), v.guardianTimezone)}.</p>
              )}
              <p className="text-sm">Assim que o pagamento for confirmado, esta página muda sozinha.</p>
            </section>
          )}
          {pending?.method === 'card' && pending.cardUrl && (
            <section className="card space-y-3" data-testid="cartao">
              <a className="btn" href={pending.cardUrl}>Ir para o pagamento com cartão</a>
            </section>
          )}
          {pending && (
            <ActionForm action={startPaymentAction} submitLabel={pending.method === 'pix' ? 'Trocar para cartão' : 'Trocar para PIX'} className="">
              <input type="hidden" name="orderId" value={id} />
              <input type="hidden" name="method" value={pending.method === 'pix' ? 'card' : 'pix'} />
            </ActionForm>
          )}
          {devChargeId && (
            <form action="/api/dev/pagar" method="post" className="notice">
              <input type="hidden" name="chargeId" value={devChargeId} />
              <input type="hidden" name="voltar" value={`/pedido/${id}`} />
              <span className="mr-2">Ambiente de desenvolvimento:</span>
              <button className="btn-secondary">Simular pagamento</button>
            </form>
          )}
        </>
      ) : v.status === 'refunded' ? (
        <p className="notice">O pagamento chegou depois que o horário foi vendido e o valor foi devolvido.
          <Link className="ml-1 text-brand underline" href={`/p/${v.teacherSlug}`}>Escolher outro horário</Link></p>
      ) : (
        <p className="error">A reserva expirou antes do pagamento.
          <Link className="ml-1 underline" href={`/p/${v.teacherSlug}`}>Escolher outro horário</Link></p>
      )}
    </div>
  );
}
