import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { Temporal } from 'temporal-polyfill';
import { PayChoice } from '@/components/aluno/PayChoice';
import { CopyButton } from '@/components/aluno/CopyButton';
import { LessonSummary } from '@/components/aluno/LessonSummary';
import { LocalWhen } from '@/components/aluno/LocalWhen';
import { ProtectedNote } from '@/components/aluno/ProtectedNote';
import { Stepper } from '@/components/aluno/Stepper';
import { ALERT, SECONDARY, TITLE } from '@/components/aluno/ui';
import { Countdown } from '@/components/Countdown';
import { OrderPoller } from '@/components/OrderPoller';
import { orderView } from '@/domain/public/order';
import { devToolsEnabled } from '@/domain/dev';
import { formatTime } from '@/time/zoned';
import { appDeps, now } from '@/server/app';
import { currentSubject } from '@/server/session';
import { startPaymentAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guardianId = await currentSubject('guardian');
  if (!guardianId) notFound();
  const deps = appDeps();
  const v = await orderView(deps, id, guardianId, await now());
  if (!v) notFound();
  if (v.status === 'paid') redirect(`/pedido/${id}/confirmado`);
  const pending = v.payment?.status === 'pending' ? v.payment : null;
  const qr = pending?.pixPayload ? await QRCode.toDataURL(pending.pixPayload, { margin: 1, width: 440 }) : null;
  let devChargeId: string | null = null;
  if (devToolsEnabled(deps.config) && pending) {
    devChargeId = (await deps.db.selectFrom('payments').select('provider_charge_id').where('order_id', '=', id)
      .where('status', '=', 'pending').executeTakeFirst())?.provider_charge_id ?? null;
  }
  const holding = v.status === 'awaiting_payment' && v.bookingStatus === 'held' && v.holdExpiresAt
    && Temporal.Instant.compare(Temporal.Instant.from(v.holdExpiresAt), await now()) > 0;
  const summary = (
    <LessonSummary photoUrl={v.teacherPhotoUrl} teacherName={v.teacherName} subject={v.subject} priceCents={v.totalCents}
      when={<><LocalWhen iso={v.startsAt} teacherTz={v.guardianTimezone} /> · para {v.studentFirstName}</>} />
  );

  return (
    <div className="space-y-5">
      <OrderPoller orderId={id} status={v.status} />
      {holding ? (
        <>
          <Countdown until={v.holdExpiresAt!} />
          <Stepper current={3} />
          {summary}
          {!pending && (
            <>
              <h1 className={TITLE}>Como você quer pagar?</h1>
              <PayChoice orderId={id} action={startPaymentAction} />
            </>
          )}
          {pending?.method === 'pix' && qr && (
            <>
              <h1 className={TITLE}>Pague com PIX</h1>
              <section className="flex flex-col items-center gap-3.5 rounded-2xl border border-site-line p-5" data-testid="pix">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR do PIX" width={220} height={220} className="rounded-xl" />
                <p className="text-center text-sm text-site-muted">
                  Abra o app do seu banco, escolha pagar com PIX e aponte a câmera, ou copie o código.
                </p>
                <CopyButton text={pending.pixPayload!} label="Copiar código PIX" targetId="pix-codigo" />
                <code id="pix-codigo" className="block w-full break-all rounded-xl bg-violet-50 p-3 text-xs text-site-muted">
                  {pending.pixPayload}
                </code>
                {pending.expiresAt && (
                  <p className="text-[13px] text-site-muted">
                    O código vale até {formatTime(Temporal.Instant.from(pending.expiresAt), v.guardianTimezone)}.
                  </p>
                )}
              </section>
            </>
          )}
          {pending?.method === 'card' && pending.cardUrl && (
            <>
              <h1 className={TITLE}>Pague com cartão</h1>
              <section className="space-y-3" data-testid="cartao">
                <a className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-indigo-600 text-[17px] font-semibold text-white hover:bg-indigo-700"
                  href={pending.cardUrl}>Ir para o pagamento seguro com cartão</a>
              </section>
            </>
          )}
          {pending && (
            <>
              <p className="flex items-center gap-2.5 text-sm text-[#3b3870]">
                <span aria-hidden="true" className="size-2.5 flex-none animate-pulse rounded-full bg-green-500" />
                Assim que o pagamento cair, esta página avança sozinha.
              </p>
              <PayChoice orderId={id} action={startPaymentAction} switchFrom={pending.method} />
            </>
          )}
          <ProtectedNote>
            <p><strong className="text-indigo-950">Pagamento protegido.</strong> O valor só vai para o professor depois da aula. Se ele faltar, o dinheiro volta inteiro.</p>
          </ProtectedNote>
          {devChargeId && (
            <form action="/api/dev/pagar" method="post" className="notice">
              <input type="hidden" name="chargeId" value={devChargeId} />
              <input type="hidden" name="voltar" value={`/pedido/${id}`} />
              <span className="mr-2">Ambiente de desenvolvimento:</span>
              <button className="btn-secondary">Simular pagamento</button>
            </form>
          )}
        </>
      ) : (
        <>
          {summary}
          <div className={`${ALERT} space-y-3`} role="alert">
            <p>
              {v.status === 'refunded'
                ? 'O pagamento chegou depois que o horário foi reservado por outra pessoa, e o valor foi devolvido.'
                : 'O tempo para pagar acabou e o horário foi liberado.'}
            </p>
          </div>
          <Link className={SECONDARY} href={`/p/${v.teacherSlug}`}>Escolher outro horário</Link>
        </>
      )}
    </div>
  );
}
