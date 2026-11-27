/**
 * Contestação da aula (§1, desvios: "Família contesta a aula em até 24 horas"):
 * o repasse fica retido e a equipe decide com o registro da sala ou do código.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { decideOutcome } from '@/domain/lessons/close';
import { disputeState, openDispute, openDisputes, resolveDispute } from '@/domain/lessons/dispute';
import { releaseDuePayouts } from '@/domain/payouts/release';
import { refundList } from '@/domain/staff/lists';
import { teacherLessons } from '@/domain/teachers/lessons';
import { accountView } from '@/domain/guardians/account';
import { closeAppDb } from '../helpers/app';
import { closeTestPool, queuedJobs, testPool, truncateAll } from '../helpers/db';
import { insertGuardian } from '../helpers/fixtures';
import { paidLesson, testDeps, TUE_14 } from '../helpers/scenario';

beforeEach(truncateAll);
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = () => testDeps();
const q = async (text: string, params: unknown[] = []) => (await testPool().query(text, params)).rows;
const END = TUE_14.add({ hours: 1 });
const AFTER = END.add({ minutes: 11 });

async function staff() {
  return (await q(`INSERT INTO staff_users (email, name) VALUES ('ops@exemplo.com', 'Ops') RETURNING id`))[0]!.id as string;
}

/** Aula paga e dada (decisão da equipe), com o repasse retido até 24 horas depois do fim. */
async function taughtLesson() {
  const l = await paidLesson();
  const s = await staff();
  await decideOutcome(deps(), { bookingId: l.bookingId, outcome: 'taught', staffId: s }, AFTER);
  return { ...l, staffId: s };
}

const payoutStatus = async (bookingId: string) =>
  (await q(`SELECT status FROM payouts WHERE booking_id = $1`, [bookingId]))[0]!.status;
const templates = async (bookingId: string) =>
  (await q(`SELECT DISTINCT template FROM notifications WHERE booking_id = $1 ORDER BY template`, [bookingId])).map((r) => r.template);

describe('família contesta a aula', () => {
  it('em até 2 horas: o repasse fica retido, o professor é avisado e nada é liberado', async () => {
    const l = await taughtLesson();
    expect(await disputeState(deps().db, l.guardianId, l.bookingId, END.add({ hours: 1 }))).toMatchObject({
      canOpen: true, openUntil: END.add({ hours: 2 }).toString(), dispute: null,
    });
    await openDispute(deps(), {
      guardianId: l.guardianId, bookingId: l.bookingId, reason: 'not_happened', details: 'O professor não apareceu.',
    }, END.add({ hours: 1 }));
    expect(await q(`SELECT opened_by, status, reason FROM disputes WHERE booking_id = $1`, [l.bookingId])).toEqual([
      { opened_by: 'guardian', status: 'open', reason: 'A aula não aconteceu: O professor não apareceu.' },
    ]);
    expect(await templates(l.bookingId)).toContain('contestacao_aberta_professor');
    expect(await releaseDuePayouts(deps(), END.add({ hours: 25 }))).toMatchObject({ claimed: 0 });
    expect(await payoutStatus(l.bookingId)).toBe('held');
    expect(await disputeState(deps().db, l.guardianId, l.bookingId, END.add({ hours: 3 }))).toMatchObject({
      canOpen: false, dispute: { status: 'open' },
    });
    expect((await teacherLessons(deps().db, l.teacherId, END.add({ hours: 3 })))[0]).toMatchObject({ dispute: 'open' });
    expect((await accountView(deps(), l.guardianId, END.add({ hours: 3 }))).past[0]).toMatchObject({ canDispute: false, disputeStatus: 'open' });
  });

  it('a conta da família oferece contestar só dentro do prazo', async () => {
    const l = await taughtLesson();
    expect((await accountView(deps(), l.guardianId, END.add({ hours: 1 }))).past[0]).toMatchObject({ canDispute: true, disputeStatus: null });
    expect((await accountView(deps(), l.guardianId, END.add({ hours: 25 }))).past[0]).toMatchObject({ canDispute: false });
  });

  it('depois de 2 horas do fim da aula, não dá mais para contestar', async () => {
    const l = await taughtLesson();
    const late = END.add({ hours: 2, minutes: 1 });
    expect(await disputeState(deps().db, l.guardianId, l.bookingId, late)).toMatchObject({ canOpen: false });
    await expect(openDispute(deps(), { guardianId: l.guardianId, bookingId: l.bookingId, reason: 'other', details: 'x' }, late))
      .rejects.toThrow(/prazo/);
  });

  it('só o responsável da aula contesta, uma vez, e "outro motivo" pede a explicação', async () => {
    const l = await taughtLesson();
    const other = await insertGuardian(testPool());
    const when = END.add({ hours: 1 });
    await expect(openDispute(deps(), { guardianId: other, bookingId: l.bookingId, reason: 'not_happened' }, when))
      .rejects.toThrow(/não encontrada/);
    await expect(openDispute(deps(), { guardianId: l.guardianId, bookingId: l.bookingId, reason: 'other', details: ' ' }, when))
      .rejects.toThrow(/conte o que aconteceu/);
    await openDispute(deps(), { guardianId: l.guardianId, bookingId: l.bookingId, reason: 'ended_early' }, when);
    await expect(openDispute(deps(), { guardianId: l.guardianId, bookingId: l.bookingId, reason: 'ended_early' }, when))
      .rejects.toThrow(/já foi contestada/);
  });

  it('aula que ainda não aconteceu não pode ser contestada', async () => {
    const l = await paidLesson();
    await expect(openDispute(deps(), { guardianId: l.guardianId, bookingId: l.bookingId, reason: 'not_happened' }, END))
      .rejects.toThrow(/só depois da aula/);
  });
});

describe('a equipe decide', () => {
  it('a fila mostra a contestação com a evidência da aula', async () => {
    const l = await taughtLesson();
    await openDispute(deps(), { guardianId: l.guardianId, bookingId: l.bookingId, reason: 'not_happened' }, END.add({ hours: 1 }));
    const list = await openDisputes(deps().db);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      bookingId: l.bookingId, teacherName: 'Ana Souza', guardianName: 'Maria Lima', studentFirstName: 'Joana',
      reason: 'A aula não aconteceu', modality: 'online', outcome: 'taught', amountCents: 12100,
      evidence: { teacherSeconds: 0, studentSeconds: 0, checkedIn: false },
    });
  });

  it('a favor do professor: o repasse sai na varredura seguinte e os dois são avisados', async () => {
    const l = await taughtLesson();
    await openDispute(deps(), { guardianId: l.guardianId, bookingId: l.bookingId, reason: 'ended_early' }, END.add({ hours: 1 }));
    const [d] = await openDisputes(deps().db);
    await resolveDispute(deps(), { disputeId: d!.id, staffId: l.staffId, decision: 'for_teacher', note: 'A sala mostra 58 minutos.' }, END.add({ hours: 30 }));
    expect(await q(`SELECT status, decision_note, resolved_by FROM disputes`)).toEqual([
      { status: 'for_teacher', decision_note: 'A sala mostra 58 minutos.', resolved_by: l.staffId },
    ]);
    expect(await releaseDuePayouts(deps(), END.add({ hours: 31 }))).toMatchObject({ released: 1 });
    expect(await templates(l.bookingId)).toEqual(expect.arrayContaining(['contestacao_negada_professor', 'contestacao_negada_responsavel']));
    await expect(resolveDispute(deps(), { disputeId: d!.id, staffId: l.staffId, decision: 'for_guardian', note: 'x' }, END.add({ hours: 32 })))
      .rejects.toThrow(/já foi decidida/);
  });

  it('a favor da família: devolve o valor da aula e o repasse não sai', async () => {
    const l = await taughtLesson();
    await openDispute(deps(), { guardianId: l.guardianId, bookingId: l.bookingId, reason: 'not_happened' }, END.add({ hours: 1 }));
    const [d] = await openDisputes(deps().db);
    await expect(resolveDispute(deps(), { disputeId: d!.id, staffId: l.staffId, decision: 'for_guardian', note: '' }, END.add({ hours: 2 })))
      .rejects.toThrow(/motivo/);
    await resolveDispute(deps(), { disputeId: d!.id, staffId: l.staffId, decision: 'for_guardian', note: 'Sala vazia.' }, END.add({ hours: 2 }));
    expect(await payoutStatus(l.bookingId)).toBe('refunded');
    expect((await queuedJobs()).filter((j) => j.task === 'payment.refund').map((j) => j.payload))
      .toEqual([{ paymentId: l.paymentId, amountCents: 12100 }]);
    expect(await q(`SELECT status FROM orders WHERE id = $1`, [l.orderId])).toEqual([{ status: 'refunded' }]);
    expect(await templates(l.bookingId)).toEqual(expect.arrayContaining(['contestacao_aceita_professor', 'contestacao_aceita_responsavel']));
    expect(await releaseDuePayouts(deps(), END.add({ hours: 31 }))).toMatchObject({ claimed: 0 });
    expect((await refundList(deps().db)).map((r) => r.reason)).toEqual(['dispute']);
    expect(await openDisputes(deps().db)).toEqual([]);
  });
});
