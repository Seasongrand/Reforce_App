/**
 * Confirmação por webhook (§2.4): evento gravado primeiro em webhook_events,
 * confirmação condicional, pagamento tardio que tenta reocupar ou devolve, e
 * a varredura que expira reservas e cancela cobranças.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { holdSlots } from '@/domain/booking/hold';
import { startPayment } from '@/domain/payment/charge';
import { handlePaymentWebhook, retryDeferredWebhooks } from '@/domain/payment/webhook';
import { refundPayment } from '@/domain/payment/refund';
import { expireHolds } from '@/domain/sweeps';
import { FakePaymentProvider } from '@/providers/payment/fake';
import { WebhookSignatureError } from '@/providers/errors';
import { appDb, closeAppDb } from '../helpers/app';
import { closeTestPool, queuedJobs, testPool, truncateAll } from '../helpers/db';
import { family, listedTeacher, NOW, testDeps, TUE_14, type ServiceOpts } from '../helpers/scenario';

beforeEach(truncateAll);
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = () => testDeps();
const fake = () => deps().providers.payment as FakePaymentProvider;
const q = async (text: string, params: unknown[] = []) => (await testPool().query(text, params)).rows;

async function heldOrder(o: { service?: ServiceOpts; withAddress?: boolean } = {}) {
  const t = await listedTeacher({ service: o.service });
  const f = await family({ withAddress: o.withAddress });
  const r = await holdSlots(deps(), {
    teacherId: t.teacherId, serviceId: t.serviceId, guardianId: f.guardianId, studentId: f.studentId,
    addressId: f.addressId, startsAt: [TUE_14], idempotencyKey: randomUUID(),
  }, NOW);
  if (!r.ok) throw new Error(`esperava reserva, veio ${r.reason}`);
  const p = await startPayment(deps(), { orderId: r.orderId, guardianId: f.guardianId, method: 'pix' }, NOW);
  const [payment] = await q(`SELECT provider_charge_id FROM payments WHERE id = $1`, [p.paymentId]);
  return { ...t, ...f, ...r, paymentId: p.paymentId, chargeId: payment!.provider_charge_id as string };
}

const pay = (chargeId: string, now = NOW.add({ minutes: 2 }), eventId = randomUUID()) => {
  const { headers, body } = fake().simulateEvent(chargeId, 'payment.paid', eventId);
  return handlePaymentWebhook(deps(), headers, body, now);
};

describe('confirmação por webhook', () => {
  it('o mesmo evento duas vezes: processado e depois repetido; efeitos uma vez só', async () => {
    const o = await heldOrder();
    const eventId = randomUUID();
    expect(await pay(o.chargeId, NOW.add({ minutes: 2 }), eventId)).toEqual({ status: 'processed' });
    const notifications = (await q(`SELECT count(*)::int AS n FROM notifications`))[0]!.n;
    expect(notifications).toBeGreaterThan(0);
    expect(await pay(o.chargeId, NOW.add({ minutes: 3 }), eventId)).toEqual({ status: 'duplicate' });
    expect(await q(`SELECT count(*)::int AS n FROM webhook_events`)).toEqual([{ n: 1 }]);
    expect(await q(`SELECT status FROM bookings`)).toEqual([{ status: 'confirmed' }]);
    expect(await q(`SELECT status FROM orders`)).toEqual([{ status: 'paid' }]);
    expect(await q(`SELECT status FROM payments`)).toEqual([{ status: 'paid' }]);
    expect((await q(`SELECT count(*)::int AS n FROM notifications`))[0]!.n).toBe(notifications);
  });

  it('pagamento 1 segundo antes do fim da reserva confirma a aula', async () => {
    const o = await heldOrder();
    const [p] = await q(`SELECT expires_at FROM payments`);
    expect((p!.expires_at as Date).getTime()).toBeLessThan(o.holdExpiresAt.epochMilliseconds);
    expect(await pay(o.chargeId, o.holdExpiresAt.subtract({ seconds: 1 }))).toEqual({ status: 'processed' });
    expect(await q(`SELECT status, hold_expires_at FROM bookings`)).toEqual([{ status: 'confirmed', hold_expires_at: null }]);
  });

  it('aula online: cria registro da aula e enfileira sala de vídeo e retrato da busca', async () => {
    const o = await heldOrder();
    await pay(o.chargeId);
    const [ls] = await q(`SELECT checkin_code_hash FROM lesson_sessions WHERE booking_id = $1`, [o.bookingIds[0]]);
    expect(ls).toEqual({ checkin_code_hash: null });
    const tasks = (await queuedJobs()).map((j) => j.task);
    expect(tasks).toContain('video.create_room');
    expect(tasks).toContain('search.refresh_teacher');
    expect(tasks).not.toContain('calendar.create_event'); // sem calendário conectado
  });

  it('aula presencial: guarda o hash do código da aula; com calendário conectado, enfileira o evento', async () => {
    const o = await heldOrder({ service: { modality: 'at_teacher' } });
    await testPool().query(`INSERT INTO calendar_connections (teacher_id, provider) VALUES ($1, 'fake')`, [o.teacherId]);
    await pay(o.chargeId);
    const [ls] = await q(`SELECT checkin_code_hash FROM lesson_sessions WHERE booking_id = $1`, [o.bookingIds[0]]);
    expect(ls!.checkin_code_hash).toMatch(/^[0-9a-f]{64}$/);
    const tasks = (await queuedJobs()).map((j) => j.task);
    expect(tasks).toContain('calendar.create_event');
    expect(tasks).not.toContain('video.create_room');
  });

  it('assinatura inválida é recusada e nada é gravado', async () => {
    const o = await heldOrder();
    const { body } = fake().simulateEvent(o.chargeId, 'payment.paid');
    await expect(handlePaymentWebhook(deps(), { 'x-fake-signature': '0'.repeat(64) }, body, NOW)).rejects.toThrow(
      WebhookSignatureError,
    );
    expect(await q(`SELECT count(*)::int AS n FROM webhook_events`)).toEqual([{ n: 0 }]);
  });

  it('notificação que chega antes do registro da cobrança fica adiada e é processada depois', async () => {
    const o = await heldOrder();
    // cobrança criada no provedor, mas ainda sem linha em payments
    const charge = await fake().createCharge({
      orderId: o.orderId, method: 'card', amountCents: 12100, description: 'x',
      split: { walletId: 'w', fixedCents: 11495 }, escrow: true, expiresAt: o.holdExpiresAt, payer: { name: 'x', phone: 'x' },
    });
    const { headers, body } = fake().simulateEvent(charge.providerChargeId, 'payment.paid');
    expect(await handlePaymentWebhook(deps(), headers, body, NOW.add({ minutes: 1 }))).toEqual({ status: 'deferred' });
    expect(await q(`SELECT status FROM bookings`)).toEqual([{ status: 'held' }]);
    await testPool().query(
      `INSERT INTO payments (order_id, provider, provider_charge_id, method, amount_cents, platform_fee_cents)
       VALUES ($1, 'fake', $2, 'card', 12100, 605)`,
      [o.orderId, charge.providerChargeId],
    );
    expect(await retryDeferredWebhooks(deps(), NOW.add({ minutes: 2 }), { olderThanSeconds: 0 })).toBe(1);
    expect(await q(`SELECT status FROM bookings`)).toEqual([{ status: 'confirmed' }]);
  });

  it('pagamento em dobro do mesmo pedido: o segundo é devolvido', async () => {
    const o = await heldOrder();
    await pay(o.chargeId);
    const charge = await fake().createCharge({
      orderId: o.orderId, method: 'card', amountCents: 12100, description: 'x',
      split: { walletId: 'w', fixedCents: 11495 }, escrow: true, expiresAt: o.holdExpiresAt, payer: { name: 'x', phone: 'x' },
    });
    await testPool().query(
      `INSERT INTO payments (order_id, provider, provider_charge_id, method, amount_cents, platform_fee_cents)
       VALUES ($1, 'fake', $2, 'card', 12100, 605)`,
      [o.orderId, charge.providerChargeId],
    );
    expect(await pay(charge.providerChargeId)).toEqual({ status: 'processed' });
    const refunds = (await queuedJobs()).filter((j) => j.task === 'payment.refund');
    expect(refunds).toHaveLength(1);
    expect(await q(`SELECT status FROM orders`)).toEqual([{ status: 'paid' }]);
  });
});

describe('expiração e pagamento tardio', () => {
  it('a varredura expira a reserva vencida, o pedido e cancela a cobrança no provedor', async () => {
    const o = await heldOrder();
    expect(await expireHolds(deps(), NOW.add({ minutes: 9 }))).toMatchObject({ bookings: 0 });
    expect(await expireHolds(deps(), NOW.add({ minutes: 11 }))).toMatchObject({ bookings: 1, charges: 1 });
    expect(await q(`SELECT status FROM bookings`)).toEqual([{ status: 'expired' }]);
    expect(await q(`SELECT status FROM orders`)).toEqual([{ status: 'expired' }]);
    expect(await q(`SELECT status FROM payments`)).toEqual([{ status: 'expired' }]);
    expect(await q(`SELECT ref FROM dev_provider_calls WHERE operation = 'cancelCharge'`)).toEqual([{ ref: o.chargeId }]);
  });

  it('pagamento tardio com o horário ainda livre: a aula é reocupada e confirmada', async () => {
    const o = await heldOrder();
    await expireHolds(deps(), NOW.add({ minutes: 11 }));
    expect(await pay(o.chargeId, NOW.add({ minutes: 12 }))).toEqual({ status: 'processed' });
    expect(await q(`SELECT id, status FROM bookings`)).toEqual([{ id: o.bookingIds[0], status: 'confirmed' }]);
    expect(await q(`SELECT status FROM orders`)).toEqual([{ status: 'paid' }]);
    expect(await q(`SELECT status FROM payments`)).toEqual([{ status: 'paid' }]);
  });

  it('pagamento tardio com o horário vendido a outra família: devolve o valor e avisa', async () => {
    const o = await heldOrder();
    await expireHolds(deps(), NOW.add({ minutes: 11 }));
    // outra família reserva e paga o mesmo horário
    const f2 = await family();
    const r2 = await holdSlots(deps(), {
      teacherId: o.teacherId, serviceId: o.serviceId, guardianId: f2.guardianId, studentId: f2.studentId,
      startsAt: [TUE_14], idempotencyKey: randomUUID(),
    }, NOW.add({ minutes: 11 }));
    expect(r2.ok).toBe(true);

    expect(await pay(o.chargeId, NOW.add({ minutes: 12 }))).toEqual({ status: 'processed' });
    expect(await q(`SELECT status FROM orders WHERE id = $1`, [o.orderId])).toEqual([{ status: 'refunded' }]);
    expect(await q(`SELECT status FROM bookings WHERE id = $1`, [o.bookingIds[0]])).toEqual([{ status: 'expired' }]);
    const refunds = (await queuedJobs()).filter((j) => j.task === 'payment.refund');
    expect(refunds).toEqual([{ task: 'payment.refund', payload: { paymentId: o.paymentId } }]);
    const notes = await q(`SELECT template FROM notifications WHERE booking_id = $1`, [o.bookingIds[0]]);
    expect(notes.map((n) => n.template)).toContain('pagamento_tardio_reembolso');

    // a tarefa de devolução chama o provedor e marca a cobrança
    await refundPayment(deps(), o.paymentId, NOW.add({ minutes: 13 }));
    await refundPayment(deps(), o.paymentId, NOW.add({ minutes: 14 })); // repetida: não chama de novo
    expect(await q(`SELECT ref FROM dev_provider_calls WHERE operation = 'refund'`)).toEqual([{ ref: o.chargeId }]);
    expect(await q(`SELECT status FROM payments WHERE id = $1`, [o.paymentId])).toEqual([{ status: 'refunded' }]);
  });

  it('pagamento tardio depois do horário da aula: devolve sem reocupar', async () => {
    const o = await heldOrder();
    await expireHolds(deps(), NOW.add({ minutes: 11 }));
    expect(await pay(o.chargeId, TUE_14.add({ minutes: 5 }))).toEqual({ status: 'processed' });
    expect(await q(`SELECT status FROM bookings`)).toEqual([{ status: 'expired' }]);
    expect(await q(`SELECT status FROM orders`)).toEqual([{ status: 'refunded' }]);
  });
});
