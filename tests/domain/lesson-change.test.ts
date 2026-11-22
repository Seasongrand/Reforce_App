/**
 * Cancelar e remarcar (regra do dono, 21/11): com 24 horas ou mais até a aula,
 * a família cancela com devolução integral ou remarca; com menos, só remarca.
 * O professor cancela aula paga com devolução integral. Os dois são avisados
 * e o horário volta para a agenda.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import {
  cancelByFamily, cancelByTeacher, changeOptions, rescheduleByFamily, rescheduleSlots,
} from '@/domain/lessons/change';
import { sendDueNotifications } from '@/domain/notifications/send';
import { appDb, closeAppDb } from '../helpers/app';
import { closeTestPool, queuedJobs, testPool, truncateAll } from '../helpers/db';
import { insertBooking, insertFamilyOrder } from '../helpers/fixtures';
import { activeBookings, NOW, paidLesson, testDeps, TUE_14 } from '../helpers/scenario';

beforeEach(truncateAll);
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const q = async (text: string, params: unknown[] = []) => (await testPool().query(text, params)).rows;
const NEXT_TUE = Temporal.Instant.from('2026-11-24T17:00:00Z'); // terça seguinte, 14h em São Paulo
const status = async (id: string) => (await q(`SELECT status FROM bookings WHERE id = $1`, [id]))[0]!.status as string;
const notices = async (bookingId: string) =>
  (await q(`SELECT DISTINCT template FROM notifications WHERE booking_id = $1 ORDER BY template`, [bookingId])).map((r) => r.template);

describe('o que a família pode fazer', () => {
  it('com 24 horas ou mais (inclusive exatamente 24), cancela com devolução e remarca; com menos, só remarca', async () => {
    const l = await paidLesson();
    expect(await changeOptions(appDb(), l.guardianId, l.bookingId, NOW)).toMatchObject({
      canCancel: true, canReschedule: true, refundCents: 12100, reschedulesLeft: 2,
    });
    expect((await changeOptions(appDb(), l.guardianId, l.bookingId, NOW))!.freeCancelUntil.toString()).toBe('2026-11-16T17:00:00Z');
    expect(await changeOptions(appDb(), l.guardianId, l.bookingId, TUE_14.subtract({ hours: 24 })))
      .toMatchObject({ canCancel: true });
    expect(await changeOptions(appDb(), l.guardianId, l.bookingId, TUE_14.subtract({ hours: 23, minutes: 59 })))
      .toMatchObject({ canCancel: false, canReschedule: true });
  });

  it('aula de outra família ou que já começou: nada a fazer', async () => {
    const l = await paidLesson();
    const other = await paidLesson();
    expect(await changeOptions(appDb(), other.guardianId, l.bookingId, NOW)).toBeNull();
    expect(await changeOptions(appDb(), l.guardianId, l.bookingId, TUE_14)).toBeNull();
  });
});

describe('cancelar pela família', () => {
  it('com 24 horas ou mais: aula cancelada, horário livre, devolução integral na fila e os dois avisados', async () => {
    const l = await paidLesson();
    expect(await cancelByFamily(testDeps(), { guardianId: l.guardianId, bookingId: l.bookingId }, NOW)).toEqual({ refundCents: 12100 });
    expect(await status(l.bookingId)).toBe('cancelled');
    expect(await q(`SELECT status FROM orders WHERE id = $1`, [l.orderId])).toEqual([{ status: 'refunded' }]);
    expect((await queuedJobs()).filter((j) => j.task === 'payment.refund').map((j) => j.payload))
      .toEqual([{ paymentId: l.paymentId, amountCents: 12100 }]);
    expect(await notices(l.bookingId)).toEqual(expect.arrayContaining(['cancelada_pela_familia', 'cancelamento_confirmado']));
    expect(await activeBookings(l.teacherId)).toBe(0);
    expect((await rescheduleSlots(testDeps(), l.guardianId, l.bookingId, NOW))).toEqual([]); // aula cancelada não remarca
  });

  it('com menos de 24 horas: recusado, e a aula continua confirmada', async () => {
    const l = await paidLesson();
    await expect(cancelByFamily(testDeps(), { guardianId: l.guardianId, bookingId: l.bookingId }, TUE_14.subtract({ hours: 2 })))
      .rejects.toThrow('menos de 24 horas');
    expect(await status(l.bookingId)).toBe('confirmed');
  });

  it('outra família: recusado', async () => {
    const l = await paidLesson();
    const other = await paidLesson();
    await expect(cancelByFamily(testDeps(), { guardianId: other.guardianId, bookingId: l.bookingId }, NOW)).rejects.toThrow('aula não encontrada');
    expect(await status(l.bookingId)).toBe('confirmed');
  });
});

describe('remarcar', () => {
  it('a aula nova fica confirmada no mesmo pedido; a antiga, remarcada, e o horário dela volta a ficar livre', async () => {
    const l = await paidLesson();
    expect((await rescheduleSlots(testDeps(), l.guardianId, l.bookingId, NOW)).map(String)).toContain(NEXT_TUE.toString());
    const r = await rescheduleByFamily(testDeps(), { guardianId: l.guardianId, bookingId: l.bookingId, startsAt: NEXT_TUE }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await status(l.bookingId)).toBe('rescheduled');
    const [nb] = await q(`SELECT order_id, status, rescheduled_from, starts_at FROM bookings WHERE id = $1`, [r.bookingId]);
    expect(nb).toEqual({ order_id: l.orderId, status: 'confirmed', rescheduled_from: l.bookingId, starts_at: new Date(NEXT_TUE.epochMilliseconds) });
    expect(await q(`SELECT count(*)::int AS n FROM lesson_sessions WHERE booking_id = $1`, [r.bookingId])).toEqual([{ n: 1 }]);
    expect(await notices(r.bookingId)).toEqual(['lembrete_1h_responsavel', 'lembrete_24h_responsavel', 'remarcada_professor', 'remarcada_responsavel']);
    expect((await rescheduleSlots(testDeps(), l.guardianId, r.bookingId, NOW)).map(String)).toContain(TUE_14.toString());
    // os lembretes da data antiga não saem
    await sendDueNotifications(testDeps(), TUE_14);
    expect(await q(`SELECT DISTINCT status FROM notifications WHERE booking_id = $1 AND template LIKE 'lembrete%'`, [l.bookingId]))
      .toEqual([{ status: 'cancelled' }]);
  });

  it('remarcar e logo depois cancelar: o professor recebe os dois avisos, nesta ordem', async () => {
    const l = await paidLesson();
    const r = await rescheduleByFamily(testDeps(), { guardianId: l.guardianId, bookingId: l.bookingId, startsAt: NEXT_TUE }, NOW);
    if (!r.ok) throw new Error('esperava remarcar');
    await cancelByFamily(testDeps(), { guardianId: l.guardianId, bookingId: r.bookingId }, NOW);
    await sendDueNotifications(testDeps(), NOW);
    expect(await q(
      `SELECT template, status FROM notifications WHERE booking_id = $1 AND template IN ('remarcada_professor', 'cancelada_pela_familia') AND channel = 'email' ORDER BY template`,
      [r.bookingId],
    )).toEqual([{ template: 'cancelada_pela_familia', status: 'sent' }, { template: 'remarcada_professor', status: 'sent' }]);
  });

  it('com menos de 24 horas ainda remarca', async () => {
    const l = await paidLesson();
    const r = await rescheduleByFamily(testDeps(), { guardianId: l.guardianId, bookingId: l.bookingId, startsAt: NEXT_TUE }, TUE_14.subtract({ hours: 3 }));
    expect(r.ok).toBe(true);
  });

  it('horário que outra família pegou: recusado, e a aula antiga continua confirmada', async () => {
    const l = await paidLesson();
    const fam = await insertFamilyOrder(testPool(), l.teacherId, l.serviceId);
    await insertBooking(testPool(), { ...fam, teacherId: l.teacherId, serviceId: l.serviceId, startsAt: '2026-11-24 14:00-03' });
    const r = await rescheduleByFamily(testDeps(), { guardianId: l.guardianId, bookingId: l.bookingId, startsAt: NEXT_TUE }, NOW);
    expect(r).toEqual({ ok: false, reason: 'ocupado' });
    expect(await status(l.bookingId)).toBe('confirmed');
    expect(await q(`SELECT count(*)::int AS n FROM bookings WHERE order_id = $1`, [l.orderId])).toEqual([{ n: 1 }]);
  });

  it('no máximo 2 remarcações por aula', async () => {
    const l = await paidLesson();
    const a = await rescheduleByFamily(testDeps(), { guardianId: l.guardianId, bookingId: l.bookingId, startsAt: NEXT_TUE }, NOW);
    if (!a.ok) throw new Error('esperava remarcar');
    const b = await rescheduleByFamily(testDeps(), { guardianId: l.guardianId, bookingId: a.bookingId, startsAt: NEXT_TUE.add({ hours: 1 }) }, NOW);
    if (!b.ok) throw new Error('esperava remarcar de novo');
    expect(await changeOptions(appDb(), l.guardianId, b.bookingId, NOW)).toMatchObject({ canReschedule: false, reschedulesLeft: 0 });
    await expect(rescheduleByFamily(testDeps(), { guardianId: l.guardianId, bookingId: b.bookingId, startsAt: NEXT_TUE.add({ hours: 2 }) }, NOW))
      .rejects.toThrow('já foi remarcada 2 vezes');
  });
});

describe('cancelar pelo professor', () => {
  it('devolução integral e aviso à família; outro professor não cancela', async () => {
    const l = await paidLesson();
    const other = await paidLesson();
    await expect(cancelByTeacher(testDeps(), { teacherId: other.teacherId, bookingId: l.bookingId }, NOW)).rejects.toThrow('aula não encontrada');
    expect(await cancelByTeacher(testDeps(), { teacherId: l.teacherId, bookingId: l.bookingId }, TUE_14.subtract({ hours: 1 })))
      .toEqual({ refundCents: 12100 });
    expect(await status(l.bookingId)).toBe('cancelled');
    expect(await notices(l.bookingId)).toEqual(expect.arrayContaining(['cancelada_pelo_professor']));
    expect((await queuedJobs()).filter((j) => j.task === 'payment.refund').map((j) => j.payload))
      .toEqual([{ paymentId: l.paymentId, amountCents: 12100 }]);
  });
});
