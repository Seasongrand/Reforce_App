/**
 * Meus ganhos (Recebimento): quanto o professor tem a receber, quanto já foi
 * liberado no mês e no total, e a lista por aula. Só lê a tabela de repasses.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { teacherEarnings } from '@/domain/teachers/earnings';
import { appDb, closeAppDb } from '../helpers/app';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { insertBooking, insertFamilyOrder, insertService, insertTeacher, seedTestCatalog } from '../helpers/fixtures';
import { NOW } from '../helpers/scenario';

beforeEach(async () => {
  await truncateAll();
  await seedTestCatalog(testPool());
});
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

/** Uma aula com repasse no estado pedido. */
async function lessonWithPayout(teacherId: string, serviceId: string, startsAt: string, p: {
  status: 'held' | 'releasing' | 'released' | 'refunded'; teacherCents: number; releasedAt?: string;
}) {
  const fam = await insertFamilyOrder(testPool(), teacherId, serviceId);
  const bookingId = await insertBooking(testPool(), { ...fam, teacherId, serviceId, startsAt, status: 'completed' });
  await testPool().query(
    `INSERT INTO payouts (booking_id, teacher_id, gross_cents, commission_bps, platform_cents, teacher_cents, status, release_after, released_at)
     VALUES ($1, $2, $3 + 605, 500, 605, $3, $4, $5::timestamptz + interval '1 day', $6)`,
    [bookingId, teacherId, p.teacherCents, p.status, startsAt, p.releasedAt ?? null],
  );
  return bookingId;
}

describe('meus ganhos', () => {
  it('a receber soma retido e em liberação; liberado separa o mês do total; devolvido fica de fora', async () => {
    const t = await insertTeacher(testPool());
    const svc = await insertService(testPool(), t);
    const held = await lessonWithPayout(t, svc, '2026-11-15 10:00-03', { status: 'held', teacherCents: 11495 });
    const releasing = await lessonWithPayout(t, svc, '2026-11-14 10:00-03', { status: 'releasing', teacherCents: 10000 });
    const thisMonth = await lessonWithPayout(t, svc, '2026-11-10 10:00-03', { status: 'released', teacherCents: 9000, releasedAt: '2026-11-11 12:00-03' });
    const lastMonth = await lessonWithPayout(t, svc, '2026-10-20 10:00-03', { status: 'released', teacherCents: 8000, releasedAt: '2026-10-21 12:00-03' });
    const refunded = await lessonWithPayout(t, svc, '2026-11-12 10:00-03', { status: 'refunded', teacherCents: 7000 });

    const e = await teacherEarnings(appDb(), t, NOW);
    expect(e.pendingCents).toBe(11495 + 10000);
    expect(e.pendingCount).toBe(2);
    expect(e.releasedMonthCents).toBe(9000);
    expect(e.releasedTotalCents).toBe(9000 + 8000);
    expect(e.items.map((i) => i.bookingId)).toEqual([held, releasing, refunded, thisMonth, lastMonth]);
    expect(e.items[0]).toMatchObject({ status: 'held', teacherCents: 11495, grossCents: 12100, commissionBps: 500, studentFirstName: 'Aluno' });
    expect(e.items[3]!.releasedAt?.toString()).toBe('2026-11-11T15:00:00Z');
  });

  it('"este mês" segue o fuso do professor: 31/10 às 23h30 em São Paulo ainda é outubro', async () => {
    const t = await insertTeacher(testPool());
    const svc = await insertService(testPool(), t);
    await lessonWithPayout(t, svc, '2026-10-30 10:00-03', { status: 'released', teacherCents: 4000, releasedAt: '2026-10-31 23:30-03' });
    await lessonWithPayout(t, svc, '2026-10-31 10:00-03', { status: 'released', teacherCents: 3000, releasedAt: '2026-11-01 00:30-03' });
    const e = await teacherEarnings(appDb(), t, NOW);
    expect(e.releasedMonthCents).toBe(3000);
    expect(e.releasedTotalCents).toBe(7000);
  });

  it('professor sem repasses: tudo zero e lista vazia; repasse de outro professor não entra', async () => {
    const t = await insertTeacher(testPool());
    const other = await insertTeacher(testPool());
    await lessonWithPayout(other, await insertService(testPool(), other), '2026-11-15 10:00-03', { status: 'held', teacherCents: 5000 });
    expect(await teacherEarnings(appDb(), t, NOW)).toEqual({ pendingCents: 0, pendingCount: 0, releasedMonthCents: 0, releasedTotalCents: 0, items: [] });
  });
});
