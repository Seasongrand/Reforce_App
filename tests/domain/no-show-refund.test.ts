/**
 * Falta justificada: depois de uma aula em que o aluno faltou, o professor
 * pode devolver o valor ao responsável enquanto o repasse ainda está retido
 * (até 2 horas depois da aula).
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Temporal } from 'temporal-polyfill';
import { createVideoRoom } from '@/domain/jobs';
import { closeLessons } from '@/domain/lessons/close';
import { refundNoShowByTeacher } from '@/domain/lessons/no-show-refund';
import { handleVideoWebhook } from '@/domain/lessons/presence';
import { refundPayment } from '@/domain/payment/refund';
import { releaseDuePayouts } from '@/domain/payouts/release';
import { teacherLessons } from '@/domain/teachers/lessons';
import type { FakeVideoProvider } from '@/providers/video/fake';
import { appDb, closeAppDb } from '../helpers/app';
import { closeTestPool, queuedJobs, testPool, truncateAll } from '../helpers/db';
import { paidLesson, testDeps, TUE_14, NOW } from '../helpers/scenario';

beforeEach(truncateAll);
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = (env: Record<string, string> = {}) => testDeps(env);
const q = async (text: string, params: unknown[] = []) => (await testPool().query(text, params)).rows;
const END = TUE_14.add({ hours: 1 }); // 18:00Z
const AFTER = END.add({ minutes: 11 });

async function presence(room: string, role: 'teacher' | 'student', when: Temporal.Instant) {
  const v = deps().providers.video as FakeVideoProvider;
  const { headers, body } = v.simulatePresence(room, role, 'joined', when);
  return handleVideoWebhook(deps(), headers, body, when);
}

/** Aula online em que só o professor entrou: falta do aluno. */
async function noShowLesson(env: Record<string, string> = {}) {
  const l = await paidLesson();
  await createVideoRoom(deps(), l.bookingId, NOW);
  await presence(`fake-room-${l.bookingId}`, 'teacher', TUE_14);
  await closeLessons(deps(env), AFTER);
  return l;
}

const payoutStatus = async (bookingId: string) =>
  (await q(`SELECT status FROM payouts WHERE booking_id = $1`, [bookingId]))[0]?.status;
const refundJobs = async () => (await queuedJobs()).filter((j) => j.task === 'payment.refund');

describe('falta justificada: o professor devolve o valor ao aluno', () => {
  it('devolve a aula inteira: repasse devolvido, cobrança devolvida e aviso ao responsável', async () => {
    const l = await noShowLesson();
    await refundNoShowByTeacher(deps(), { teacherId: l.teacherId, bookingId: l.bookingId }, END.add({ hours: 1 }));
    expect(await payoutStatus(l.bookingId)).toBe('refunded');
    expect(await refundJobs()).toEqual([{ task: 'payment.refund', payload: { paymentId: l.paymentId, amountCents: 12100 } }]);
    expect(await q(`SELECT status FROM orders WHERE id = $1`, [l.orderId])).toEqual([{ status: 'refunded' }]);
    const notes = await q(`SELECT DISTINCT template FROM notifications WHERE booking_id = $1`, [l.bookingId]);
    expect(notes.map((n) => n.template)).toContain('falta_aluno_devolvida');
    // o repasse devolvido não é liberado ao professor no fim do prazo
    expect(await releaseDuePayouts(deps(), END.add({ hours: 25 }))).toMatchObject({ released: 0 });
    await refundPayment(deps(), l.paymentId, END.add({ hours: 2 }), 12100);
    expect(await q(`SELECT status, refunded_cents FROM payments WHERE id = $1`, [l.paymentId])).toEqual([
      { status: 'refunded', refunded_cents: 12100 },
    ]);
  });

  it('com parte já devolvida (STUDENT_NO_SHOW_TEACHER_PCT=50), devolve o resto: a família recebe a aula inteira', async () => {
    const l = await noShowLesson({ STUDENT_NO_SHOW_TEACHER_PCT: '50' });
    await refundPayment(deps(), l.paymentId, AFTER, 6050);
    await refundNoShowByTeacher(deps(), { teacherId: l.teacherId, bookingId: l.bookingId }, END.add({ hours: 1 }));
    expect((await refundJobs()).at(-1)).toEqual({ task: 'payment.refund', payload: { paymentId: l.paymentId, amountCents: 12100 } });
  });

  it('só o professor da aula, só aula com falta do aluno, e uma vez só', async () => {
    const l = await noShowLesson();
    const other = await paidLesson(); // outro professor, aula ainda não encerrada
    await expect(refundNoShowByTeacher(deps(), { teacherId: other.teacherId, bookingId: l.bookingId }, END.add({ hours: 1 })))
      .rejects.toThrow(/não encontrada/);
    await expect(refundNoShowByTeacher(deps(), { teacherId: other.teacherId, bookingId: other.bookingId }, END.add({ hours: 1 })))
      .rejects.toThrow(/aluno faltou/);
    await refundNoShowByTeacher(deps(), { teacherId: l.teacherId, bookingId: l.bookingId }, END.add({ hours: 1 }));
    await expect(refundNoShowByTeacher(deps(), { teacherId: l.teacherId, bookingId: l.bookingId }, END.add({ hours: 1 })))
      .rejects.toThrow(/já foi devolvido/);
  });

  it('passadas 2 horas da aula, não dá mais: o valor já é do professor', async () => {
    const l = await noShowLesson();
    await expect(refundNoShowByTeacher(deps(), { teacherId: l.teacherId, bookingId: l.bookingId }, END.add({ hours: 2 })))
      .rejects.toThrow(/prazo/);
    expect(await payoutStatus(l.bookingId)).toBe('held');
    await releaseDuePayouts(deps(), END.add({ hours: 2 }));
    await expect(refundNoShowByTeacher(deps(), { teacherId: l.teacherId, bookingId: l.bookingId }, END.add({ hours: 2 })))
      .rejects.toThrow(/prazo/);
    expect(await refundJobs()).toEqual([]);
  });

  it('o painel do professor mostra até quando dá para devolver, e depois que foi devolvido', async () => {
    const l = await noShowLesson();
    const before = (await teacherLessons(appDb(), l.teacherId, END.add({ hours: 1 }))).find((x) => x.bookingId === l.bookingId)!;
    expect(before).toMatchObject({ status: 'no_show', refundCents: 12100, refunded: false });
    expect(before.refundableUntil?.toString()).toBe(END.add({ hours: 2 }).toString());
    const late = (await teacherLessons(appDb(), l.teacherId, END.add({ hours: 2 }))).find((x) => x.bookingId === l.bookingId)!;
    expect(late.refundableUntil).toBeNull();
    await refundNoShowByTeacher(deps(), { teacherId: l.teacherId, bookingId: l.bookingId }, END.add({ hours: 1 }));
    const after = (await teacherLessons(appDb(), l.teacherId, END.add({ hours: 1 }))).find((x) => x.bookingId === l.bookingId)!;
    expect(after).toMatchObject({ refunded: true, refundableUntil: null });
  });
});
