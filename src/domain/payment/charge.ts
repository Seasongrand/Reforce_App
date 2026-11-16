/**
 * Cobrança de um pedido em reserva temporária (§2.4, "Pagamento e prazo").
 * O QR do PIX expira PIX_EXPIRY_LEAD_MINUTES antes da reserva, para que um
 * pagamento no último segundo ainda a encontre em 'held'. O professor recebe
 * valor fixo calculado sobre o preço cheio, com a parte dele retida (§3.4).
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { CheckoutData, PaymentMethod } from '@/providers/payment/types';
import { instantFromDb } from '@/time/zoned';
import { splitCommission } from '../payouts/split';
import type { Deps } from '../deps';
import { DomainError } from '../errors';

export interface StartPaymentResult {
  paymentId: string;
  checkoutData: CheckoutData;
  expiresAt: Temporal.Instant;
}

export async function startPayment(
  deps: Deps,
  input: { orderId: string; guardianId: string; method: PaymentMethod },
  now: Temporal.Instant,
): Promise<StartPaymentResult> {
  const { db, providers, config } = deps;
  return db.transaction().execute(async (trx) => {
    await sql`SELECT pg_advisory_xact_lock(hashtextextended('order:' || ${input.orderId}, 0))`.execute(trx);
    const order = await trx
      .selectFrom('orders')
      .innerJoin('guardians', 'guardians.id', 'orders.guardian_id')
      .innerJoin('services', 'services.id', 'orders.service_id')
      .select([
        'orders.id', 'orders.status', 'orders.total_cents', 'orders.commission_bps', 'orders.teacher_id',
        'guardians.name', 'guardians.email', 'guardians.phone_e164', 'services.subject',
      ])
      .where('orders.id', '=', input.orderId)
      .where('orders.guardian_id', '=', input.guardianId)
      .executeTakeFirst();
    if (!order) throw new DomainError('not_found', 'pedido não encontrado');
    if (order.status !== 'awaiting_payment') throw new DomainError('conflict', 'este pedido não está aguardando pagamento');

    const hold = await sql<{ until: string | null }>`
      SELECT min(hold_expires_at) AS until FROM bookings WHERE order_id = ${order.id} AND status = 'held'`.execute(trx);
    const until = hold.rows[0]?.until ? instantFromDb(hold.rows[0].until) : null;
    if (!until || until.epochMilliseconds <= now.epochMilliseconds) {
      throw new DomainError('conflict', 'a reserva expirou; escolha o horário de novo');
    }

    const pending = await trx.selectFrom('payments').select(['id', 'method', 'provider_charge_id', 'checkout_data', 'expires_at'])
      .where('order_id', '=', order.id).where('status', '=', 'pending').execute();
    const same = pending.find((p) => p.method === input.method);
    if (same) {
      return {
        paymentId: same.id,
        checkoutData: same.checkout_data as CheckoutData,
        expiresAt: instantFromDb(same.expires_at!),
      };
    }
    for (const p of pending) {
      await providers.payment.cancelCharge(p.provider_charge_id);
      await trx.updateTable('payments').set({ status: 'expired' }).where('id', '=', p.id).execute();
    }

    const account = await trx.selectFrom('teacher_payment_accounts').select('wallet_id')
      .where('teacher_id', '=', order.teacher_id).where('status', '=', 'active').executeTakeFirst();
    if (!account) throw new DomainError('conflict', 'o professor ainda não pode receber pagamentos');

    const split = splitCommission(order.total_cents, order.commission_bps);
    const expiresAt = until.subtract({ minutes: config.pixExpiryLeadMinutes });
    const charge = await providers.payment.createCharge({
      orderId: order.id,
      method: input.method,
      amountCents: order.total_cents,
      description: `Aula particular (${order.subject})`,
      split: { walletId: account.wallet_id, fixedCents: split.teacher },
      escrow: true,
      expiresAt,
      payer: { name: order.name, email: order.email, phone: order.phone_e164 },
    });
    const payment = await trx
      .insertInto('payments')
      .values({
        order_id: order.id,
        provider: providers.payment.name,
        provider_charge_id: charge.providerChargeId,
        method: input.method,
        amount_cents: order.total_cents,
        platform_fee_cents: split.platform,
        status: 'pending',
        expires_at: expiresAt.toString(),
        checkout_data: JSON.stringify(charge.checkoutData),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { paymentId: payment.id, checkoutData: charge.checkoutData, expiresAt };
  });
}
