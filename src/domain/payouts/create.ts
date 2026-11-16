/**
 * Um repasse por aula, criado quando a aula termina (§2.2: cada aula concluída
 * gera um repasse), com a comissão congelada no pedido desde a reserva. Fica
 * retido até o fim da janela de contestação.
 */
import { sql, type Transaction } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { DB } from '@/db/types';
import { instantFromDb } from '@/time/zoned';
import type { Deps } from '../deps';
import { splitCommission } from './split';

export async function createPayoutForBooking(
  deps: Deps,
  trx: Transaction<DB>,
  bookingId: string,
  pct = 100,
): Promise<{ priceCents: number; grossCents: number; paymentId: string }> {
  const { rows } = await sql<{
    total_cents: number; lessons: number; commission_bps: number; ends_at: string; teacher_id: string;
    payment_id: string; provider_charge_id: string;
  }>`
    SELECT o.total_cents, o.lessons, o.commission_bps, b.ends_at, b.teacher_id, p.id AS payment_id, p.provider_charge_id
      FROM bookings b
      JOIN orders o ON o.id = b.order_id
      JOIN payments p ON p.order_id = o.id AND p.status = 'paid'
     WHERE b.id = ${bookingId}
     ORDER BY p.paid_at LIMIT 1`.execute(trx);
  const r = rows[0];
  if (!r) throw new Error(`aula ${bookingId} sem cobrança paga`);
  const priceCents = Math.floor(r.total_cents / r.lessons);
  const grossCents = Math.round((priceCents * pct) / 100);
  if (grossCents > 0) {
    const { platform, teacher } = splitCommission(grossCents, r.commission_bps);
    const releaseAfter = instantFromDb(r.ends_at).add({ hours: deps.config.disputeWindowHours });
    await sql`INSERT INTO payouts (booking_id, teacher_id, gross_cents, commission_bps, platform_cents, teacher_cents,
                                   release_after, provider_escrow_id)
              VALUES (${bookingId}, ${r.teacher_id}, ${grossCents}, ${r.commission_bps}, ${platform}, ${teacher},
                      ${releaseAfter.toString()}::timestamptz, ${r.provider_charge_id})
              ON CONFLICT (booking_id) DO NOTHING`.execute(trx);
  }
  return { priceCents, grossCents, paymentId: r.payment_id };
}
