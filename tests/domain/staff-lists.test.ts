/**
 * Listas do painel da equipe: professores por situação, aulas de hoje (dia de
 * São Paulo) e reembolsos com o motivo. Só leitura.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { lessonsOfDay, refundList, teachersByStatus } from '@/domain/staff/lists';
import { appDb, closeAppDb } from '../helpers/app';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { insertBooking, insertFamilyOrder, insertGuardian, insertService, insertTeacher, seedTestCatalog } from '../helpers/fixtures';
import { NOW } from '../helpers/scenario';

beforeEach(async () => {
  await truncateAll();
  await seedTestCatalog(testPool());
});
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const q = (text: string, params: unknown[] = []) => testPool().query(text, params);

async function teacher(name: string, status: string, createdAt: string, email: string | null) {
  const id = await insertTeacher(testPool(), { display_name: name });
  await q(`UPDATE teachers SET status = $2, created_at = $3, email = $4 WHERE id = $1`, [id, status, createdAt, email]);
  return id;
}

describe('professores por situação', () => {
  it('conta por situação e lista os mais novos primeiro; professor sem e-mail não quebra', async () => {
    await teacher('Ana', 'approved', '2026-11-01 10:00-03', 'ana@exemplo.com');
    await teacher('Bruno', 'in_review', '2026-11-10 10:00-03', 'bruno@exemplo.com');
    await teacher('Carla', 'draft', '2026-11-12 10:00-03', null);
    const r = await teachersByStatus(appDb());
    expect(r.counts).toEqual({ draft: 1, in_review: 1, approved: 1, paused: 0, suspended: 0 });
    expect(r.teachers.map((t) => t.name)).toEqual(['Carla', 'Bruno', 'Ana']);
    expect(r.teachers[0]).toMatchObject({ email: null, status: 'draft' });
    expect(r.teachers[2]!.createdAt.toString()).toBe('2026-11-01T13:00:00Z');
  });
});

describe('aulas de hoje', () => {
  it('aulas pagas que começam no dia de São Paulo, por horário, com cancelada; fora: ontem à noite, amanhã e reserva não paga', async () => {
    const t = await insertTeacher(testPool(), { display_name: 'Ana Souza' });
    const svc = await insertService(testPool(), t);
    const book = async (startsAt: string, status = 'confirmed') => {
      const fam = await insertFamilyOrder(testPool(), t, svc);
      return insertBooking(testPool(), { ...fam, teacherId: t, serviceId: svc, startsAt, status });
    };
    const early = await book('2026-11-16 00:30-03'); // 03:30 UTC
    const late = await book('2026-11-16 23:00-03'); // 02:00 UTC do dia 17
    const cancelled = await book('2026-11-16 15:00-03', 'cancelled');
    await book('2026-11-15 23:30-03', 'completed'); // 02:30 UTC do dia 16, mas dia 15 em São Paulo
    await book('2026-11-17 10:00-03');
    await book('2026-11-16 18:00-03', 'held');
    await q(`INSERT INTO lesson_sessions (booking_id, checked_in_at) VALUES ($1, '2026-11-16 00:35-03')`, [early]);

    const day = await lessonsOfDay(appDb(), NOW);
    expect(day.map((l) => l.bookingId)).toEqual([early, cancelled, late]);
    expect(day[0]).toMatchObject({ teacherName: 'Ana Souza', studentFirstName: 'Aluno', status: 'confirmed', checkedIn: true, modality: 'online' });
    expect(day[1]).toMatchObject({ status: 'cancelled', checkedIn: false });
  });
});

describe('reembolsos', () => {
  async function refunded(o: {
    orderStatus: string; paidAt: string; refundedCents: number; guardian?: string;
    lesson?: { status: string; outcome?: string; payout?: string };
  }) {
    const t = await insertTeacher(testPool(), { display_name: 'Ana Souza' });
    const svc = await insertService(testPool(), t);
    const guardianId = await insertGuardian(testPool(), { name: o.guardian ?? 'Maria Lima' });
    const fam = await insertFamilyOrder(testPool(), t, svc, { guardianId });
    await q(`UPDATE orders SET status = $2 WHERE id = $1`, [fam.orderId, o.orderStatus]);
    await q(
      `INSERT INTO payments (order_id, provider, provider_charge_id, method, amount_cents, status, paid_at, refunded_cents)
       VALUES ($1, 'dev', $2, 'pix', 12100, $3, $4, $5)`,
      [fam.orderId, randomUUID(), o.refundedCents === 12100 ? 'refunded' : 'paid', o.paidAt, o.refundedCents],
    );
    if (o.lesson) {
      const b = await insertBooking(testPool(), { ...fam, teacherId: t, serviceId: svc, startsAt: o.paidAt, status: o.lesson.status });
      if (o.lesson.outcome) await q(`INSERT INTO lesson_sessions (booking_id, outcome) VALUES ($1, $2)`, [b, o.lesson.outcome]);
      if (o.lesson.payout) {
        await q(
          `INSERT INTO payouts (booking_id, teacher_id, gross_cents, commission_bps, platform_cents, teacher_cents, status, release_after)
           VALUES ($1, $2, 12100, 500, 605, 11495, $3, now())`,
          [b, t, o.lesson.payout],
        );
      }
    }
    return fam.orderId;
  }

  it('motivo de cada devolução, valor já devolvido e os mais recentes primeiro; pedido pago sem devolução fica de fora', async () => {
    const excused = await refunded({ orderStatus: 'refunded', paidAt: '2026-11-10 10:00-03', refundedCents: 12100, lesson: { status: 'no_show', outcome: 'student_no_show', payout: 'refunded' } });
    const teacherAbsent = await refunded({ orderStatus: 'refunded', paidAt: '2026-11-12 10:00-03', refundedCents: 0, guardian: 'João Alves', lesson: { status: 'cancelled', outcome: 'teacher_no_show' } });
    const partial = await refunded({ orderStatus: 'partially_refunded', paidAt: '2026-11-11 10:00-03', refundedCents: 6050, lesson: { status: 'no_show', outcome: 'student_no_show', payout: 'held' } });
    const late = await refunded({ orderStatus: 'refunded', paidAt: '2026-11-13 10:00-03', refundedCents: 12100 });
    await refunded({ orderStatus: 'paid', paidAt: '2026-11-14 10:00-03', refundedCents: 0, lesson: { status: 'confirmed' } });

    const list = await refundList(appDb());
    expect(list.map((r) => r.orderId)).toEqual([late, teacherAbsent, partial, excused]);
    expect(list.map((r) => r.reason)).toEqual(['late_payment', 'teacher_no_show', 'student_no_show', 'student_excused']);
    expect(list[1]).toMatchObject({ guardianName: 'João Alves', teacherName: 'Ana Souza', amountCents: 12100, refundedCents: 0 });
    expect(list[2]!.refundedCents).toBe(6050);
    expect(list[0]!.paidAt.toString()).toBe('2026-11-13T13:00:00Z');
  });
});
