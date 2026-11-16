/**
 * Apêndice §2.6: liberação de repasses com FOR UPDATE SKIP LOCKED e estado
 * intermediário 'releasing'; comissão congelada.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CLAIM_DUE_PAYOUTS_SQL, MARK_RELEASED_SQL } from '@/domain/payouts/sql';
import { splitCommission } from '@/domain/payouts/split';
import { closeTestPool, newClient, testPool, truncateAll } from '../helpers/db';
import { insertBooking, insertFamilyOrder, insertService, insertTeacher } from '../helpers/fixtures';

const db = () => testPool();
beforeEach(truncateAll);
afterAll(closeTestPool);

const NOW = '2026-11-20 12:00-03';

async function payoutFor(teacherId: string, serviceId: string, startsAt: string, releaseAfter: string) {
  const fam = await insertFamilyOrder(db(), teacherId, serviceId);
  const bookingId = await insertBooking(db(), { ...fam, teacherId, serviceId, startsAt, status: 'completed' });
  const { platform, teacher } = splitCommission(12100, 1500);
  const { rows } = await db().query<{ id: string }>(
    `INSERT INTO payouts (booking_id, teacher_id, gross_cents, commission_bps, platform_cents, teacher_cents,
                          release_after, provider_escrow_id)
     VALUES ($1, $2, 12100, 1500, $3, $4, $5, $6) RETURNING id`,
    [bookingId, teacherId, platform, teacher, releaseAfter, `esc_${bookingId}`],
  );
  return { payoutId: rows[0]!.id, bookingId };
}

describe('liberação de repasses', () => {
  it('dois processos simultâneos: um pega 3, o outro 1; disputado e não vencido ficam retidos', async () => {
    const teacherId = await insertTeacher(db());
    const serviceId = await insertService(db(), teacherId);
    const due = [];
    for (let d = 10; d <= 13; d++) {
      due.push((await payoutFor(teacherId, serviceId, `2026-11-${d} 14:00-03`, `2026-11-${d + 1} 15:00-03`)).payoutId);
    }
    const disputed = await payoutFor(teacherId, serviceId, '2026-11-14 14:00-03', '2026-11-15 15:00-03');
    await db().query(`INSERT INTO disputes (booking_id, opened_by, reason) VALUES ($1, 'guardian', 'professor faltou')`, [
      disputed.bookingId,
    ]);
    const notDue = await payoutFor(teacherId, serviceId, '2026-11-20 14:00-03', '2026-11-21 15:00-03');

    const a = await newClient();
    const b = await newClient();
    try {
      await a.query('BEGIN');
      await b.query('BEGIN');
      const gotA = (await a.query<{ id: string }>(CLAIM_DUE_PAYOUTS_SQL, [NOW, 3])).rows.map((r) => r.id);
      const gotB = (await b.query<{ id: string }>(CLAIM_DUE_PAYOUTS_SQL, [NOW, 50])).rows.map((r) => r.id);
      await a.query('COMMIT');
      await b.query('COMMIT');
      expect(gotA).toHaveLength(3);
      expect(gotB).toHaveLength(1);
      expect(gotA.filter((id) => gotB.includes(id))).toEqual([]);
      expect([...gotA, ...gotB].sort()).toEqual([...due].sort());
    } finally {
      await a.end();
      await b.end();
    }
    const { rows } = await db().query<{ id: string; status: string }>(
      `SELECT id, status FROM payouts WHERE id = ANY($1)`,
      [[disputed.payoutId, notDue.payoutId]],
    );
    expect(rows.map((r) => r.status)).toEqual(['held', 'held']);
  });

  it('marcar como liberado altera 1 linha na primeira vez e nenhuma na segunda', async () => {
    const teacherId = await insertTeacher(db());
    const serviceId = await insertService(db(), teacherId);
    const { payoutId } = await payoutFor(teacherId, serviceId, '2026-11-10 14:00-03', '2026-11-11 15:00-03');
    const claimed = await db().query(CLAIM_DUE_PAYOUTS_SQL, [NOW, 50]);
    expect(claimed.rowCount).toBe(1);
    expect((await db().query(MARK_RELEASED_SQL, [payoutId, NOW])).rowCount).toBe(1);
    expect((await db().query(MARK_RELEASED_SQL, [payoutId, NOW])).rowCount).toBe(0);
  });

  it('repasse em held (não reivindicado) não pode ser marcado como liberado', async () => {
    const teacherId = await insertTeacher(db());
    const serviceId = await insertService(db(), teacherId);
    const { payoutId } = await payoutFor(teacherId, serviceId, '2026-11-10 14:00-03', '2026-11-11 15:00-03');
    expect((await db().query(MARK_RELEASED_SQL, [payoutId, NOW])).rowCount).toBe(0);
  });
});

describe('comissão congelada', () => {
  it('R$ 121,00 a 15% dá R$ 18,15 para a plataforma e R$ 102,85 para o professor', () => {
    expect(splitCommission(12100, 1500)).toEqual({ platform: 1815, teacher: 10285 });
  });

  it('arredonda a parte da plataforma meio para cima; o professor fica com o resto', () => {
    expect(splitCommission(9999, 1500)).toEqual({ platform: 1500, teacher: 8499 });
    expect(splitCommission(12100, 500)).toEqual({ platform: 605, teacher: 11495 });
  });

  it('recusa valores inválidos', () => {
    expect(() => splitCommission(-1, 1500)).toThrow(RangeError);
    expect(() => splitCommission(100.5, 1500)).toThrow(RangeError);
    expect(() => splitCommission(100, 10001)).toThrow(RangeError);
  });
});
