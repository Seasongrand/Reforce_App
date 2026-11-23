/**
 * Horário fixo semanal (decisão do dono, 22/11): a aula da semana seguinte fica
 * reservada para a família; o PIX sai 5 dias antes; sem pagamento até 24 horas
 * antes, só aquela semana é perdida; três semanas seguidas sem pagar encerram.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Temporal } from 'temporal-polyfill';
import { holdSlots } from '@/domain/booking/hold';
import { endWeeklySeries, prepareWeeklySeries, startWeeklySeries, weeklySeriesOf } from '@/domain/booking/weekly';
import { handlePaymentWebhook } from '@/domain/payment/webhook';
import { expireHolds } from '@/domain/sweeps';
import type { FakePaymentProvider } from '@/providers/payment/fake';
import { closeAppDb } from '../helpers/app';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { at, family, NOW, paidLesson, testDeps, TUE_14 } from '../helpers/scenario';

beforeEach(truncateAll);
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = () => testDeps();
const q = async (text: string, params: unknown[] = []) => (await testPool().query(text, params)).rows;
const WEEK = (n: number) => TUE_14.add({ hours: 24 * 7 * n }); // terças às 14h em São Paulo (sem horário de verão)

const seriesBookings = async (seriesId: string) =>
  q(`SELECT b.status, b.starts_at, b.hold_expires_at, o.status AS order_status
       FROM bookings b JOIN orders o ON o.id = b.order_id WHERE b.series_id = $1 ORDER BY b.starts_at`, [seriesId]);

async function pay(orderId: string, when: Temporal.Instant) {
  const charge = (await q(`SELECT provider_charge_id FROM payments WHERE order_id = $1 AND status = 'pending'`, [orderId]))[0]!
    .provider_charge_id as string;
  const d = deps();
  const { headers, body } = (d.providers.payment as FakePaymentProvider).simulateEvent(charge, 'payment.paid');
  await handlePaymentWebhook(d, headers, body, when);
}

async function weekly() {
  const l = await paidLesson();
  const seriesId = await startWeeklySeries(deps(), { guardianId: l.guardianId, bookingId: l.bookingId }, NOW);
  return { ...l, seriesId };
}

describe('começar o horário fixo', () => {
  it('a partir de uma aula paga da família; a semana seguinte já fica reservada, sem cobrança ainda', async () => {
    const l = await weekly();
    expect(await q(`SELECT status, local_start::text, timezone FROM weekly_series WHERE id = $1`, [l.seriesId])).toEqual([
      { status: 'active', local_start: '2026-11-17 14:00:00', timezone: 'America/Sao_Paulo' },
    ]);
    expect(await q(`SELECT series_id FROM bookings WHERE id = $1`, [l.bookingId])).toEqual([{ series_id: l.seriesId }]);
    await prepareWeeklySeries(deps(), NOW);
    await prepareWeeklySeries(deps(), NOW); // repetir não cria outra
    const rows = await seriesBookings(l.seriesId);
    expect(rows.map((r) => [r.status, new Date(r.starts_at).toISOString()])).toEqual([
      ['confirmed', TUE_14.toString().replace('Z', '.000Z')],
      ['held', WEEK(1).toString().replace('Z', '.000Z')],
    ]);
    expect(new Date(rows[1]!.hold_expires_at).toISOString()).toBe(WEEK(1).subtract({ hours: 24 }).toString().replace('Z', '.000Z'));
    expect(await q(`SELECT count(*)::int AS n FROM payments p JOIN bookings b ON b.order_id = p.order_id WHERE b.series_id = $1`, [l.seriesId]))
      .toEqual([{ n: 1 }]); // só a da primeira aula
  });

  it('o horário reservado não é vendido para outra família', async () => {
    const l = await weekly();
    await prepareWeeklySeries(deps(), NOW);
    const other = await family();
    const r = await holdSlots(deps(), {
      teacherId: l.teacherId, serviceId: l.serviceId, guardianId: other.guardianId, studentId: other.studentId,
      startsAt: [WEEK(1)], idempotencyKey: randomUUID(),
    }, NOW);
    expect(r).toMatchObject({ ok: false, reason: 'ocupado' });
  });

  it('só o responsável da aula, com aula paga, e uma vez', async () => {
    const l = await paidLesson();
    const other = await family();
    await expect(startWeeklySeries(deps(), { guardianId: other.guardianId, bookingId: l.bookingId }, NOW)).rejects.toThrow(/não encontrada/);
    await startWeeklySeries(deps(), { guardianId: l.guardianId, bookingId: l.bookingId }, NOW);
    await expect(startWeeklySeries(deps(), { guardianId: l.guardianId, bookingId: l.bookingId }, NOW)).rejects.toThrow(/já é horário fixo/);
  });
});

describe('cobrança da semana', () => {
  it('5 dias antes sai o PIX e a família é avisada; pago, a aula é confirmada', async () => {
    const l = await weekly();
    await prepareWeeklySeries(deps(), NOW);
    const [, next] = await q(`SELECT id, order_id FROM bookings WHERE series_id = $1 ORDER BY starts_at`, [l.seriesId]);
    await prepareWeeklySeries(deps(), WEEK(1).subtract({ hours: 24 * 5 + 1 }));
    expect(await q(`SELECT count(*)::int AS n FROM payments WHERE order_id = $1`, [next!.order_id])).toEqual([{ n: 0 }]);
    const fiveDays = WEEK(1).subtract({ hours: 24 * 5 });
    await prepareWeeklySeries(deps(), fiveDays);
    expect(await q(`SELECT method, status FROM payments WHERE order_id = $1`, [next!.order_id])).toEqual([{ method: 'pix', status: 'pending' }]);
    expect(await q(`SELECT DISTINCT template FROM notifications WHERE booking_id = $1`, [next!.id])).toEqual([{ template: 'horario_fixo_cobranca' }]);
    await pay(next!.order_id, fiveDays.add({ hours: 1 }));
    expect(await q(`SELECT status FROM bookings WHERE id = $1`, [next!.id])).toEqual([{ status: 'confirmed' }]);
  });

  it('sem pagamento até 24 horas antes, só aquela semana se perde; a seguinte é reservada', async () => {
    const l = await weekly();
    await prepareWeeklySeries(deps(), NOW);
    await prepareWeeklySeries(deps(), WEEK(1).subtract({ hours: 24 * 5 }));
    const late = WEEK(1).subtract({ hours: 23 });
    await expireHolds(deps(), late);
    await prepareWeeklySeries(deps(), late);
    const rows = await seriesBookings(l.seriesId);
    expect(rows.map((r) => r.status)).toEqual(['confirmed', 'expired', 'held']);
    expect(await q(`SELECT status FROM weekly_series WHERE id = $1`, [l.seriesId])).toEqual([{ status: 'active' }]);
  });

  it('três semanas seguidas sem pagar encerram o horário fixo e a família é avisada', async () => {
    const l = await weekly();
    let when = NOW;
    for (let week = 1; week <= 3; week++) {
      await prepareWeeklySeries(deps(), when);
      when = WEEK(week).subtract({ hours: 24 * 5 });
      await prepareWeeklySeries(deps(), when);
      when = WEEK(week).subtract({ hours: 23 });
      await expireHolds(deps(), when);
    }
    await prepareWeeklySeries(deps(), when);
    expect(await q(`SELECT status, ended_reason FROM weekly_series WHERE id = $1`, [l.seriesId])).toEqual([
      { status: 'ended', ended_reason: 'unpaid' },
    ]);
    expect((await seriesBookings(l.seriesId)).map((r) => r.status)).toEqual(['confirmed', 'expired', 'expired', 'expired']);
    const last = (await q(`SELECT id FROM bookings WHERE series_id = $1 ORDER BY starts_at DESC LIMIT 1`, [l.seriesId]))[0]!.id;
    expect(await q(`SELECT DISTINCT template FROM notifications WHERE booking_id = $1 ORDER BY template`, [last]))
      .toContainEqual({ template: 'horario_fixo_encerrado' });
  });
});

describe('encerrar', () => {
  it('a família encerra: a semana reservada e não paga é liberada; as pagas continuam', async () => {
    const l = await weekly();
    await prepareWeeklySeries(deps(), NOW);
    await endWeeklySeries(deps(), { guardianId: l.guardianId, seriesId: l.seriesId }, NOW);
    expect(await q(`SELECT status, ended_reason FROM weekly_series WHERE id = $1`, [l.seriesId])).toEqual([
      { status: 'ended', ended_reason: 'by_family' },
    ]);
    expect((await seriesBookings(l.seriesId)).map((r) => [r.status, r.order_status])).toEqual([
      ['confirmed', 'paid'], ['expired', 'expired'],
    ]);
    await prepareWeeklySeries(deps(), NOW);
    expect(await seriesBookings(l.seriesId)).toHaveLength(2);
  });

  it('a conta mostra o horário fixo com a aula a pagar', async () => {
    const l = await weekly();
    await prepareWeeklySeries(deps(), NOW);
    await prepareWeeklySeries(deps(), WEEK(1).subtract({ hours: 24 * 5 }));
    const list = await weeklySeriesOf(deps().db, l.guardianId, WEEK(1).subtract({ hours: 24 * 5 }));
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: l.seriesId, teacherName: 'Ana Souza', studentFirstName: 'Joana', weekday: 2, time: '14:00',
      nextToPay: { startsAt: WEEK(1).toString(), payUntil: WEEK(1).subtract({ hours: 24 }).toString() },
    });
    void at;
  });
});
