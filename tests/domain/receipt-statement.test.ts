/**
 * Comprovante do pagamento (família) e extrato do mês (professor).
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { decideOutcome } from '@/domain/lessons/close';
import { orderReceipt } from '@/domain/guardians/receipt';
import { refundPayment } from '@/domain/payment/refund';
import { statementCsv, statementMonths, teacherStatement } from '@/domain/teachers/statement';
import { closeAppDb } from '../helpers/app';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { insertGuardian } from '../helpers/fixtures';
import { NOW, paidLesson, testDeps, TUE_14 } from '../helpers/scenario';

beforeEach(truncateAll);
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = () => testDeps();
const q = async (text: string, params: unknown[] = []) => (await testPool().query(text, params)).rows;
const AFTER = TUE_14.add({ hours: 1, minutes: 11 });

async function taught() {
  const l = await paidLesson();
  const s = (await q(`INSERT INTO staff_users (email, name) VALUES ('ops@exemplo.com', 'Ops') RETURNING id`))[0]!.id;
  await decideOutcome(deps(), { bookingId: l.bookingId, outcome: 'taught', staffId: s }, AFTER);
  return l;
}

describe('comprovante do pagamento', () => {
  it('mostra quem pagou, quanto, como, quando e as aulas; nada de contato do professor', async () => {
    const l = await paidLesson();
    const r = await orderReceipt(deps().db, l.guardianId, l.orderId);
    expect(r).toMatchObject({
      orderId: l.orderId, number: l.orderId.slice(0, 8).toUpperCase(), amountCents: 12100, refundedCents: 0, method: 'pix',
      guardianName: 'Maria Lima', teacherName: 'Ana Souza',
      lessons: [{ startsAt: TUE_14.toString(), subject: 'Matemática', studentFirstName: 'Joana', modality: 'online', durationMin: 60 }],
    });
    expect(r!.paidAt).toBe(NOW.add({ minutes: 1 }).toString());
    const json = JSON.stringify(r);
    for (const secret of ['+5511977776666', 'Rua das Flores', 'prov_', 'wal_']) expect(json).not.toContain(secret);
  });

  it('mostra o valor devolvido', async () => {
    const l = await paidLesson();
    await refundPayment(deps(), l.paymentId, NOW, 12100);
    expect(await orderReceipt(deps().db, l.guardianId, l.orderId)).toMatchObject({ amountCents: 12100, refundedCents: 12100 });
  });

  it('não existe para outro responsável', async () => {
    const l = await paidLesson();
    const other = await insertGuardian(testPool());
    expect(await orderReceipt(deps().db, other, l.orderId)).toBeNull();
    expect(await orderReceipt(deps().db, l.guardianId, '00000000-0000-0000-0000-000000000000')).toBeNull();
  });
});

describe('extrato do professor', () => {
  it('lista as aulas do mês com bruto, comissão e o que fica com o professor; soma o que não foi devolvido', async () => {
    const l = await taught();
    const po = (await q(`SELECT gross_cents, platform_cents, teacher_cents FROM payouts WHERE booking_id = $1`, [l.bookingId]))[0]!;
    const s = await teacherStatement(deps().db, l.teacherId, '2026-11');
    expect(s).toMatchObject({
      month: '2026-11', label: 'novembro de 2026',
      totals: { lessons: 1, grossCents: po.gross_cents, platformCents: po.platform_cents, teacherCents: po.teacher_cents },
    });
    expect(s.items).toHaveLength(1);
    expect(s.items[0]).toMatchObject({ bookingId: l.bookingId, studentFirstName: 'Joana', subject: 'Matemática', status: 'held' });
    expect((await teacherStatement(deps().db, l.teacherId, '2026-10')).items).toEqual([]);

    await q(`UPDATE payouts SET status = 'refunded' WHERE booking_id = $1`, [l.bookingId]);
    const after = await teacherStatement(deps().db, l.teacherId, '2026-11');
    expect(after.items).toHaveLength(1);
    expect(after.totals).toMatchObject({ lessons: 0, teacherCents: 0 });
  });

  it('meses com aula, do mais recente ao mais antigo', async () => {
    const l = await taught();
    expect(await statementMonths(deps().db, l.teacherId)).toEqual([{ month: '2026-11', label: 'novembro de 2026' }]);
  });

  it('planilha em CSV com ponto e vírgula e valores em reais', async () => {
    const l = await taught();
    const csv = statementCsv(await teacherStatement(deps().db, l.teacherId, '2026-11'));
    const [header, row] = csv.trim().split('\r\n');
    expect(header).toBe('Data;Horário;Aluno;Disciplina;Valor da aula;Comissão;Você recebe;Situação');
    expect(row).toMatch(/^17\/11\/2026;14:00;Joana;Matemática;121,00;[\d,]+;[\d,]+;A receber$/);
  });

  it('mês inválido é recusado', async () => {
    const l = await taught();
    await expect(teacherStatement(deps().db, l.teacherId, '2026-13')).rejects.toThrow(/mês/);
  });
});
