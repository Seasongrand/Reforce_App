/**
 * Notificações do provedor de pagamento (§2.4). Toda notificação entra
 * primeiro em webhook_events; a chave única descarta a repetição antes de
 * qualquer efeito. A confirmação é condicional (status = 'held'). Zero linhas
 * significa repetição, pagamento em dobro ou pagamento tardio.
 */
import { sql, type Transaction } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { DB } from '@/db/types';
import { isSlotTaken } from '@/db/errors';
import type { PaymentEventType } from '@/providers/payment/types';
import type { HeaderBag } from '@/providers/signing';
import { instantFromDb } from '@/time/zoned';
import { enqueue } from '@/worker/enqueue';
import type { Deps } from '../deps';
import { scheduleNotice } from '../notifications/schedule';
import { onOrderConfirmed } from './confirm';

export type WebhookOutcome = 'processed' | 'duplicate' | 'deferred';

const providerKey = (deps: Deps) => `payment:${deps.providers.payment.name}`;

export async function handlePaymentWebhook(
  deps: Deps,
  headers: HeaderBag,
  rawBody: string,
  now: Temporal.Instant,
): Promise<{ status: WebhookOutcome }> {
  const ev = deps.providers.payment.parseWebhook(headers, rawBody); // lança se a assinatura não bater
  const key = providerKey(deps);
  const inserted = await sql<{ id: string }>`
    INSERT INTO webhook_events (provider, provider_event_id, payload)
    VALUES (${key}, ${ev.eventId}, ${JSON.stringify({ type: ev.type, chargeId: ev.chargeId, raw: ev.raw })}::jsonb)
    ON CONFLICT (provider, provider_event_id) DO NOTHING
    RETURNING id::text`.execute(deps.db);
  let id = inserted.rows[0]?.id;
  if (!id) {
    const existing = await sql<{ id: string; processed_at: string | null }>`
      SELECT id::text, processed_at FROM webhook_events WHERE provider = ${key} AND provider_event_id = ${ev.eventId}`
      .execute(deps.db);
    if (existing.rows[0]!.processed_at) return { status: 'duplicate' };
    id = existing.rows[0]!.id;
  }
  return { status: await processPaymentEvent(deps, id, now) };
}

export async function processPaymentEvent(deps: Deps, webhookEventId: string, now: Temporal.Instant): Promise<WebhookOutcome> {
  return deps.db.transaction().execute(async (trx) => {
    const { rows } = await sql<{ payload: { type: PaymentEventType; chargeId: string }; processed_at: string | null }>`
      SELECT payload, processed_at FROM webhook_events WHERE id = ${webhookEventId} FOR UPDATE`.execute(trx);
    const ev = rows[0]!;
    if (ev.processed_at) return 'duplicate';
    if (ev.payload.type === 'payment.other') {
      await sql`UPDATE webhook_events SET processed_at = ${now.toString()}::timestamptz WHERE id = ${webhookEventId}`.execute(trx);
      return 'processed';
    }
    const payment = await trx.selectFrom('payments').selectAll()
      .where('provider', '=', deps.providers.payment.name)
      .where('provider_charge_id', '=', ev.payload.chargeId)
      .forUpdate().executeTakeFirst();
    if (!payment) return 'deferred';

    switch (ev.payload.type) {
      case 'payment.paid':
        await onPaid(deps, trx, payment.id, payment.order_id, now);
        break;
      case 'payment.refunded':
        await sql`UPDATE payments SET status = 'refunded' WHERE id = ${payment.id}`.execute(trx);
        await sql`UPDATE orders SET status = 'refunded'
                   WHERE id = ${payment.order_id}
                     AND NOT EXISTS (SELECT 1 FROM payments WHERE order_id = ${payment.order_id} AND status = 'paid')`
          .execute(trx);
        break;
      case 'payment.failed':
        await sql`UPDATE payments SET status = 'failed' WHERE id = ${payment.id} AND status = 'pending'`.execute(trx);
        break;
      case 'payment.expired':
        await sql`UPDATE payments SET status = 'expired' WHERE id = ${payment.id} AND status = 'pending'`.execute(trx);
        break;
    }
    await sql`UPDATE webhook_events SET processed_at = ${now.toString()}::timestamptz WHERE id = ${webhookEventId}`.execute(trx);
    return 'processed';
  });
}

async function onPaid(deps: Deps, trx: Transaction<DB>, paymentId: string, orderId: string, now: Temporal.Instant) {
  const wasPaid = await sql<{ id: string }>`
    UPDATE payments SET status = 'paid', paid_at = ${now.toString()}::timestamptz
     WHERE id = ${paymentId} AND status <> 'paid' RETURNING id`.execute(trx);
  if (wasPaid.rows.length === 0) return; // esta cobrança já tinha sido tratada

  const order = await trx.selectFrom('orders').select(['teacher_id', 'status']).where('id', '=', orderId)
    .executeTakeFirstOrThrow();
  await sql`SELECT pg_advisory_xact_lock(hashtextextended('teacher:' || ${order.teacher_id}, 0))`.execute(trx);

  // confirma só o que ainda está reservado
  const confirmed = await sql<{ id: string }>`
    UPDATE bookings SET status = 'confirmed', hold_expires_at = NULL
     WHERE order_id = ${orderId} AND status = 'held' RETURNING id`.execute(trx);
  if (confirmed.rows.length > 0) {
    await onOrderConfirmed(deps, trx, orderId, confirmed.rows.map((r) => r.id), now);
    return;
  }

  // pagamento em dobro: o pedido já foi pago por outra cobrança
  const otherPaid = await sql<{ n: number }>`
    SELECT count(*)::int AS n FROM payments WHERE order_id = ${orderId} AND status = 'paid' AND id <> ${paymentId}`
    .execute(trx);
  if (otherPaid.rows[0]!.n > 0) {
    await enqueue(trx, 'payment.refund', { paymentId }, { jobKey: `refund:${paymentId}` });
    return;
  }

  // pagamento tardio: tenta reocupar o mesmo horário (§1, "PIX pago depois da expiração")
  const expired = await sql<{ id: string; starts_at: string }>`
    SELECT id, starts_at FROM bookings WHERE order_id = ${orderId} AND status = 'expired' ORDER BY starts_at`.execute(trx);
  if (expired.rows.length === 0) {
    await refundLate(trx, paymentId, orderId, null, now);
    return;
  }
  const firstBooking = expired.rows[0]!.id;
  const tooLate = expired.rows.some((b) => instantFromDb(b.starts_at).epochMilliseconds <= now.epochMilliseconds);
  if (tooLate) {
    await refundLate(trx, paymentId, orderId, firstBooking, now);
    return;
  }
  await sql`SAVEPOINT reoccupy`.execute(trx);
  try {
    const back = await sql<{ id: string }>`
      UPDATE bookings SET status = 'confirmed', hold_expires_at = NULL
       WHERE order_id = ${orderId} AND status = 'expired' RETURNING id`.execute(trx);
    await sql`RELEASE SAVEPOINT reoccupy`.execute(trx);
    await onOrderConfirmed(deps, trx, orderId, back.rows.map((r) => r.id), now);
  } catch (err) {
    if (!isSlotTaken(err)) throw err;
    await sql`ROLLBACK TO SAVEPOINT reoccupy`.execute(trx);
    await refundLate(trx, paymentId, orderId, firstBooking, now);
  }
}

/** O horário foi vendido (ou já passou): devolve pelo provedor e avisa a família. */
async function refundLate(
  trx: Transaction<DB>,
  paymentId: string,
  orderId: string,
  bookingId: string | null,
  now: Temporal.Instant,
) {
  await sql`UPDATE orders SET status = 'refunded' WHERE id = ${orderId}`.execute(trx);
  await enqueue(trx, 'payment.refund', { paymentId }, { jobKey: `refund:${paymentId}` });
  if (bookingId) await scheduleNotice(trx, bookingId, 'pagamento_tardio_reembolso', now);
}

/** Reprocessa notificações que ficaram sem efeito (cobrança ainda desconhecida, erro). */
export async function retryDeferredWebhooks(
  deps: Deps,
  now: Temporal.Instant,
  opts: { olderThanSeconds?: number; limit?: number } = {},
): Promise<number> {
  const { rows } = await sql<{ id: string }>`
    SELECT id::text FROM webhook_events
     WHERE provider = ${providerKey(deps)} AND processed_at IS NULL
       AND received_at <= now() - make_interval(secs => ${opts.olderThanSeconds ?? 30})
     ORDER BY id LIMIT ${opts.limit ?? 50}`.execute(deps.db);
  let processed = 0;
  for (const r of rows) {
    if ((await processPaymentEvent(deps, r.id, now)) === 'processed') processed += 1;
  }
  return processed;
}
