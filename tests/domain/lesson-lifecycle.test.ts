/**
 * Depois da aula (§2.6): presença pela sala de vídeo ou pelo código da aula
 * presencial, desfecho, repasse criado na conclusão com a comissão congelada,
 * liberação com SKIP LOCKED e conciliação de liberação sem resposta.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Temporal } from 'temporal-polyfill';
import { createVideoRoom } from '@/domain/jobs';
import { joinRoom } from '@/domain/lessons/room';
import { handleVideoWebhook } from '@/domain/lessons/presence';
import { checkinCode, submitCheckin } from '@/domain/lessons/checkin';
import { closeLessons, decideOutcome, pendingDecisions } from '@/domain/lessons/close';
import { releaseDuePayouts } from '@/domain/payouts/release';
import { reconcileReleasing } from '@/domain/payouts/reconcile';
import { teacherLessons } from '@/domain/teachers/lessons';
import { refundPayment } from '@/domain/payment/refund';
import type { FakeVideoProvider } from '@/providers/video/fake';
import { appDb, closeAppDb } from '../helpers/app';
import { closeTestPool, queuedJobs, testPool, truncateAll } from '../helpers/db';
import { at, NOW, paidLesson, testDeps, TUE_14 } from '../helpers/scenario';

beforeEach(truncateAll);
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = (env: Record<string, string> = {}) => testDeps(env);
const q = async (text: string, params: unknown[] = []) => (await testPool().query(text, params)).rows;
const END = TUE_14.add({ hours: 1 }); // 18:00Z
const AFTER = END.add({ minutes: 11 });

async function onlineLesson() {
  const l = await paidLesson();
  await createVideoRoom(deps(), l.bookingId, NOW);
  return { ...l, room: `fake-room-${l.bookingId}` };
}

async function presence(room: string, role: 'teacher' | 'student', kind: 'joined' | 'left', when: Temporal.Instant, eventId?: string) {
  const v = deps().providers.video as FakeVideoProvider;
  const { headers, body } = v.simulatePresence(room, role, kind, when, eventId);
  return handleVideoWebhook(deps(), headers, body, when);
}

const booking = async (id: string) => (await q(`SELECT status FROM bookings WHERE id = $1`, [id]))[0]!.status;
const payout = async (id: string) =>
  (await q(
    `SELECT gross_cents, commission_bps, platform_cents, teacher_cents, status, release_after, provider_escrow_id
       FROM payouts WHERE booking_id = $1`,
    [id],
  ))[0];

describe('sala de vídeo', () => {
  it('abre 10 minutos antes e fecha 30 minutos depois', async () => {
    const l = await onlineLesson();
    const join = (when: Temporal.Instant) =>
      joinRoom(deps(), { bookingId: l.bookingId, role: 'student', displayName: 'Joana' }, when);
    await expect(join(TUE_14.subtract({ minutes: 11 }))).rejects.toThrow(/abre/);
    await expect(join(TUE_14.subtract({ minutes: 10 }))).resolves.toMatchObject({ joinUrl: expect.stringContaining(l.room) });
    await expect(join(END.add({ minutes: 31 }))).rejects.toThrow(/encerrada/);
  });

  it('não abre sala de aula presencial nem de aula não paga', async () => {
    const l = await paidLesson({ service: { modality: 'at_teacher' } });
    await expect(
      joinRoom(deps(), { bookingId: l.bookingId, role: 'teacher', displayName: 'Ana' }, TUE_14),
    ).rejects.toThrow(/online/);
  });

  it('presença repetida conta uma vez; o tempo de cada um soma ao sair', async () => {
    const l = await onlineLesson();
    await presence(l.room, 'teacher', 'joined', TUE_14.subtract({ minutes: 2 }), 'p1');
    await presence(l.room, 'teacher', 'joined', TUE_14.subtract({ minutes: 2 }), 'p1');
    await presence(l.room, 'teacher', 'left', TUE_14.add({ minutes: 58 }), 'p2');
    const [ls] = await q(`SELECT teacher_joined_at, teacher_seconds FROM lesson_sessions WHERE booking_id = $1`, [l.bookingId]);
    expect((ls!.teacher_joined_at as Date).toISOString()).toBe('2026-11-17T16:58:00.000Z');
    expect(ls!.teacher_seconds).toBe(60 * 60);
  });
});

describe('desfecho da aula online', () => {
  it('os dois presentes: aula concluída e repasse retido até 24 h depois do fim, com a comissão do pedido', async () => {
    const l = await onlineLesson();
    await presence(l.room, 'teacher', 'joined', TUE_14.subtract({ minutes: 1 }));
    await presence(l.room, 'student', 'joined', TUE_14.add({ minutes: 2 }));
    expect(await closeLessons(deps(), END.add({ minutes: 9 }))).toMatchObject({ closed: 0 }); // ainda no prazo de folga
    expect(await closeLessons(deps(), AFTER)).toMatchObject({ closed: 1 });
    expect(await booking(l.bookingId)).toBe('completed');
    const p = await payout(l.bookingId);
    expect(p).toMatchObject({
      gross_cents: 12100, commission_bps: 500, platform_cents: 605, teacher_cents: 11495, status: 'held',
      provider_escrow_id: l.chargeId,
    });
    expect((p!.release_after as Date).toISOString()).toBe('2026-11-18T18:00:00.000Z');
    expect((await q(`SELECT outcome FROM lesson_sessions WHERE booking_id = $1`, [l.bookingId]))[0]!.outcome).toBe('taught');
  });

  it('só o professor: falta do aluno; o professor recebe por inteiro (padrão)', async () => {
    const l = await onlineLesson();
    await presence(l.room, 'teacher', 'joined', TUE_14);
    await closeLessons(deps(), AFTER);
    expect(await booking(l.bookingId)).toBe('no_show');
    expect(await payout(l.bookingId)).toMatchObject({ gross_cents: 12100, teacher_cents: 11495 });
  });

  it('falta do aluno com STUDENT_NO_SHOW_TEACHER_PCT=50: repasse da metade e devolução da outra metade', async () => {
    const l = await onlineLesson();
    await presence(l.room, 'teacher', 'joined', TUE_14);
    await closeLessons(deps({ STUDENT_NO_SHOW_TEACHER_PCT: '50' }), AFTER);
    expect(await payout(l.bookingId)).toMatchObject({ gross_cents: 6050, platform_cents: 303, teacher_cents: 5747 });
    expect((await queuedJobs()).filter((j) => j.task === 'payment.refund')).toEqual([
      { task: 'payment.refund', payload: { paymentId: l.paymentId, amountCents: 6050 } },
    ]);
  });

  it('só o aluno: falta do professor, reembolso integral, nenhum repasse e aviso à família', async () => {
    const l = await onlineLesson();
    await presence(l.room, 'student', 'joined', TUE_14);
    await closeLessons(deps(), AFTER);
    expect(await booking(l.bookingId)).toBe('cancelled');
    expect(await payout(l.bookingId)).toBeUndefined();
    expect(await q(`SELECT status FROM orders WHERE id = $1`, [l.orderId])).toEqual([{ status: 'refunded' }]);
    expect((await queuedJobs()).filter((j) => j.task === 'payment.refund')).toEqual([
      { task: 'payment.refund', payload: { paymentId: l.paymentId } },
    ]);
    const notes = await q(`SELECT DISTINCT template FROM notifications WHERE booking_id = $1`, [l.bookingId]);
    expect(notes.map((n) => n.template)).toContain('falta_professor_reembolso');
    await refundPayment(deps(), l.paymentId, AFTER);
    expect(await q(`SELECT status, refunded_cents FROM payments WHERE id = $1`, [l.paymentId])).toEqual([
      { status: 'refunded', refunded_cents: 12100 },
    ]);
  });

  it('professor que entra depois de 15 minutos conta como falta do professor', async () => {
    const l = await onlineLesson();
    await presence(l.room, 'student', 'joined', TUE_14);
    await presence(l.room, 'teacher', 'joined', TUE_14.add({ minutes: 16 }));
    await closeLessons(deps(), AFTER);
    expect(await booking(l.bookingId)).toBe('cancelled');
  });

  it('ninguém entrou: a aula fica para decisão da equipe', async () => {
    const l = await onlineLesson();
    await closeLessons(deps(), AFTER);
    expect(await booking(l.bookingId)).toBe('confirmed');
    expect((await pendingDecisions(appDb(), AFTER)).map((p) => p.bookingId)).toEqual([l.bookingId]);
  });
});

describe('aula presencial', () => {
  it('código certo: presença registrada e aula concluída no fechamento', async () => {
    const l = await paidLesson({ service: { modality: 'at_teacher' } });
    const code = checkinCode(l.bookingId, deps().config.sessionSecret);
    expect(await submitCheckin(deps(), { teacherId: l.teacherId, bookingId: l.bookingId, code }, TUE_14)).toEqual({ ok: true });
    await closeLessons(deps(), AFTER);
    expect(await booking(l.bookingId)).toBe('completed');
    expect(await payout(l.bookingId)).toMatchObject({ status: 'held' });
  });

  it('código errado é recusado; depois de 5 erros, nem o certo entra', async () => {
    const l = await paidLesson({ service: { modality: 'at_teacher' } });
    const code = checkinCode(l.bookingId, deps().config.sessionSecret);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      expect(await submitCheckin(deps(), { teacherId: l.teacherId, bookingId: l.bookingId, code: wrong }, TUE_14))
        .toMatchObject({ ok: false });
    }
    expect(await submitCheckin(deps(), { teacherId: l.teacherId, bookingId: l.bookingId, code }, TUE_14)).toEqual({
      ok: false, reason: 'bloqueado',
    });
  });

  it('código fora do horário da aula ou de outro professor é recusado', async () => {
    const l = await paidLesson({ service: { modality: 'at_teacher' } });
    const code = checkinCode(l.bookingId, deps().config.sessionSecret);
    expect(await submitCheckin(deps(), { teacherId: l.teacherId, bookingId: l.bookingId, code }, TUE_14.subtract({ hours: 1 })))
      .toEqual({ ok: false, reason: 'fora_do_horario' });
    const other = await paidLesson({ startsAt: TUE_14.add({ hours: 2 }) });
    await expect(submitCheckin(deps(), { teacherId: other.teacherId, bookingId: l.bookingId, code }, TUE_14)).rejects.toThrow(
      /não encontrada/,
    );
  });

  it('sem código: fica para decisão; a equipe decide e o repasse sai com o registro de quem decidiu', async () => {
    const l = await paidLesson({ service: { modality: 'at_teacher' } });
    await closeLessons(deps(), AFTER);
    expect(await booking(l.bookingId)).toBe('confirmed');
    const [pending] = await pendingDecisions(appDb(), AFTER);
    expect(pending).toMatchObject({ bookingId: l.bookingId, modality: 'at_teacher', reason: 'sem código presencial' });
    const staff = (await q(`INSERT INTO staff_users (email, name) VALUES ('ops@exemplo.com', 'Ops') RETURNING id`))[0]!.id;
    await decideOutcome(deps(), { bookingId: l.bookingId, outcome: 'taught', staffId: staff }, AFTER);
    expect(await booking(l.bookingId)).toBe('completed');
    expect(await payout(l.bookingId)).toMatchObject({ status: 'held' });
    const ev = await q(`SELECT actor FROM booking_events WHERE booking_id = $1 AND to_status = 'completed'`, [l.bookingId]);
    expect(ev).toEqual([{ actor: `staff:${staff}` }]);
  });
});

describe('liberação do repasse', () => {
  async function completed() {
    const l = await onlineLesson();
    await presence(l.room, 'teacher', 'joined', TUE_14);
    await presence(l.room, 'student', 'joined', TUE_14);
    await closeLessons(deps(), AFTER);
    return l;
  }

  it('antes do prazo não libera; depois libera e chama o provedor uma vez', async () => {
    const l = await completed();
    expect(await releaseDuePayouts(deps(), at('2026-11-18T17:59:00Z'))).toMatchObject({ released: 0 });
    expect(await releaseDuePayouts(deps(), at('2026-11-18T18:00:00Z'))).toMatchObject({ released: 1 });
    expect(await payout(l.bookingId)).toMatchObject({ status: 'released' });
    expect(await releaseDuePayouts(deps(), at('2026-11-18T18:05:00Z'))).toMatchObject({ released: 0 });
    expect(await q(`SELECT ref FROM dev_provider_calls WHERE operation = 'releaseEscrow'`)).toEqual([{ ref: l.chargeId }]);
  });

  it('com disputa aberta, o repasse continua retido', async () => {
    const l = await completed();
    await testPool().query(`INSERT INTO disputes (booking_id, opened_by, reason) VALUES ($1, 'guardian', 'aula curta')`, [
      l.bookingId,
    ]);
    expect(await releaseDuePayouts(deps(), at('2026-11-19T12:00:00Z'))).toMatchObject({ released: 0 });
    expect(await payout(l.bookingId)).toMatchObject({ status: 'held' });
  });

  it('resposta perdida: fica em releasing e a conciliação consulta a retenção antes de tentar de novo', async () => {
    const l = await completed();
    const failing = deps({ FAKE_FAIL: 'releaseEscrow' });
    expect(await releaseDuePayouts(failing, at('2026-11-18T18:00:00Z'))).toMatchObject({ released: 0, failed: 1 });
    expect(await payout(l.bookingId)).toMatchObject({ status: 'releasing' });
    expect(await reconcileReleasing(deps(), at('2026-11-18T18:05:00Z'))).toMatchObject({ released: 0 }); // cedo demais
    expect(await reconcileReleasing(deps(), at('2026-11-18T18:11:00Z'))).toMatchObject({ released: 1 });
    expect(await payout(l.bookingId)).toMatchObject({ status: 'released' });
    // a conciliação viu que o provedor já tinha liberado: não pediu de novo
    expect(await q(`SELECT count(*)::int AS n FROM dev_provider_calls WHERE operation = 'releaseEscrow'`)).toEqual([{ n: 1 }]);
  });

  it('duas liberações simultâneas chamam o provedor uma vez por repasse', async () => {
    await completed();
    const when = at('2026-11-18T18:00:00Z');
    const [a, b] = await Promise.all([releaseDuePayouts(deps(), when), releaseDuePayouts(deps(), when)]);
    expect(a.released + b.released).toBe(1);
    expect(await q(`SELECT count(*)::int AS n FROM dev_provider_calls WHERE operation = 'releaseEscrow'`)).toEqual([{ n: 1 }]);
  });
});

describe('aulas no painel do professor', () => {
  it('não mostra reserva não paga; mostra o endereço da família só depois do pagamento, nunca o contato', async () => {
    const l = await paidLesson({ service: { modality: 'at_student' }, withAddress: true });
    // uma segunda família só prendeu o horário das 16h, ainda sem pagar
    const { holdSlots } = await import('@/domain/booking/hold');
    const { family } = await import('../helpers/scenario');
    const f2 = await family({ withAddress: true });
    const r = await holdSlots(deps(), {
      teacherId: l.teacherId, serviceId: l.serviceId, guardianId: f2.guardianId, studentId: f2.studentId,
      addressId: f2.addressId, startsAt: [TUE_14.add({ hours: 2 })], idempotencyKey: crypto.randomUUID(),
    }, NOW);
    expect(r.ok).toBe(true);

    const lessons = await teacherLessons(appDb(), l.teacherId, NOW);
    expect(lessons.map((x) => x.bookingId)).toEqual([l.bookingId]);
    expect(lessons[0]).toMatchObject({ studentFirstName: 'Joana', modality: 'at_student', status: 'confirmed' });
    expect(lessons[0]!.address).toContain('Av. Paulista');
    expect(JSON.stringify(lessons)).not.toMatch(/\+55119|familia-.*@exemplo\.com/);
  });
});
