/**
 * Apêndice "SQL testado": linhas da tabela "Teste / Resultado" que dependem
 * só das restrições do esquema.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import {
  insertBooking,
  insertFamilyOrder,
  insertGuardian,
  insertService,
  insertTeacher,
  pgErrorCode,
  pgErrorMessage,
} from '../helpers/fixtures';

const db = () => testPool();

beforeEach(truncateAll);
afterAll(closeTestPool);

async function teacherWithService(over: Parameters<typeof insertService>[2] = {}) {
  const teacherId = await insertTeacher(db());
  const serviceId = await insertService(db(), teacherId, over);
  return { teacherId, serviceId };
}

describe('restrição de exclusão (no_double_booking)', () => {
  it('recusa duas aulas sobrepostas do mesmo professor com 23P01', async () => {
    const { teacherId, serviceId } = await teacherWithService();
    const a = await insertFamilyOrder(db(), teacherId, serviceId);
    const b = await insertFamilyOrder(db(), teacherId, serviceId);
    await insertBooking(db(), { ...a, teacherId, serviceId, startsAt: '2026-11-17 14:00-03' });
    const code = await pgErrorCode(
      insertBooking(db(), { ...b, teacherId, serviceId, startsAt: '2026-11-17 14:30-03' }),
    );
    expect(code).toBe('23P01');
  });

  it('com 10 minutos de intervalo, recusa 15h00 e aceita 15h10 depois da aula das 14h', async () => {
    const { teacherId, serviceId } = await teacherWithService({ buffer_after_min: 10 });
    const lesson = (startsAt: string, fam: Awaited<ReturnType<typeof insertFamilyOrder>>) =>
      insertBooking(db(), { ...fam, teacherId, serviceId, startsAt, bufferAfterMin: 10 });
    await lesson('2026-11-17 14:00-03', await insertFamilyOrder(db(), teacherId, serviceId));
    expect(await pgErrorCode(lesson('2026-11-17 15:00-03', await insertFamilyOrder(db(), teacherId, serviceId)))).toBe(
      '23P01',
    );
    await expect(
      lesson('2026-11-17 15:10-03', await insertFamilyOrder(db(), teacherId, serviceId)),
    ).resolves.toBeTypeOf('string');
  });

  it('aula cancelada deixa de bloquear sem ser apagada', async () => {
    const { teacherId, serviceId } = await teacherWithService();
    const a = await insertFamilyOrder(db(), teacherId, serviceId);
    const id = await insertBooking(db(), { ...a, teacherId, serviceId, startsAt: '2026-11-17 14:00-03' });
    await db().query(`UPDATE bookings SET status = 'cancelled' WHERE id = $1`, [id]);
    const b = await insertFamilyOrder(db(), teacherId, serviceId);
    await expect(
      insertBooking(db(), { ...b, teacherId, serviceId, startsAt: '2026-11-17 14:00-03' }),
    ).resolves.toBeTypeOf('string');
    const { rows } = await db().query(`SELECT count(*)::int AS n FROM bookings`);
    expect(rows[0]!.n).toBe(2);
  });
});

describe('limites do PostgreSQL que guiaram o desenho', () => {
  it('recusa coluna gerada com timestamptz - interval (expressão não imutável)', async () => {
    const msg = await pgErrorMessage(
      db().query(`ALTER TABLE bookings ADD COLUMN blocked_gen tstzrange
                    GENERATED ALWAYS AS (tstzrange(starts_at - interval '10 minutes', ends_at, '[)')) STORED`),
    );
    expect(msg).toContain('generation expression is not immutable');
  });

  it('recusa unaccent em índice de expressão (função não imutável)', async () => {
    const code = await pgErrorCode(
      db().query(`CREATE INDEX teachers_bio_unaccent ON teachers USING gin (to_tsvector('portuguese', unaccent(bio)))`),
    );
    expect(code).toBe('42P17');
  });
});

describe('acréscimos do marketplace', () => {
  it('recusa aula na casa do aluno sem endereço (23514)', async () => {
    const { teacherId, serviceId } = await teacherWithService({ modality: 'at_student' });
    const fam = await insertFamilyOrder(db(), teacherId, serviceId);
    const code = await pgErrorCode(
      insertBooking(db(), { ...fam, teacherId, serviceId, startsAt: '2026-11-17 14:00-03', modality: 'at_student' }),
    );
    expect(code).toBe('23514');
  });

  async function completedBooking() {
    const { teacherId, serviceId } = await teacherWithService();
    const fam = await insertFamilyOrder(db(), teacherId, serviceId);
    const bookingId = await insertBooking(db(), {
      ...fam,
      teacherId,
      serviceId,
      startsAt: '2026-11-17 14:00-03',
      status: 'completed',
    });
    return { teacherId, serviceId, bookingId, ...fam };
  }

  const insertPayout = (bookingId: string, teacherId: string, gross: number, platform: number, teacher: number) =>
    db().query(
      `INSERT INTO payouts (booking_id, teacher_id, gross_cents, commission_bps, platform_cents, teacher_cents, release_after)
       VALUES ($1, $2, $3, 1500, $4, $5, '2026-11-18 15:00-03')`,
      [bookingId, teacherId, gross, platform, teacher],
    );

  it('recusa segundo repasse para a mesma aula (23505)', async () => {
    const { bookingId, teacherId } = await completedBooking();
    await insertPayout(bookingId, teacherId, 12100, 1815, 10285);
    expect(await pgErrorCode(insertPayout(bookingId, teacherId, 12100, 1815, 10285))).toBe('23505');
  });

  it('recusa repasse cujas partes não somam o total (23514)', async () => {
    const { bookingId, teacherId } = await completedBooking();
    expect(await pgErrorCode(insertPayout(bookingId, teacherId, 12100, 1815, 10000))).toBe('23514');
  });

  it('origem da família registrada duas vezes: prevalece o primeiro registro', async () => {
    const teacherId = await insertTeacher(db());
    const guardianId = await insertGuardian(db());
    const link = (acq: string) =>
      db().query(
        `INSERT INTO teacher_guardian_links (teacher_id, guardian_id, acquisition) VALUES ($1, $2, $3)
         ON CONFLICT (teacher_id, guardian_id) DO NOTHING`,
        [teacherId, guardianId, acq],
      );
    await link('teacher_link');
    await link('marketplace');
    const { rows } = await db().query(`SELECT acquisition FROM teacher_guardian_links`);
    expect(rows).toEqual([{ acquisition: 'teacher_link' }]);
  });

  it('recusa mensagem entre professor e responsável sem vínculo (23503)', async () => {
    const teacherId = await insertTeacher(db());
    const guardianId = await insertGuardian(db());
    const code = await pgErrorCode(
      db().query(`INSERT INTO messages (teacher_id, guardian_id, sender, body) VALUES ($1, $2, 'guardian', 'oi')`, [
        teacherId,
        guardianId,
      ]),
    );
    expect(code).toBe('23503');
  });

  describe('avaliação de aula concluída (SQL do apêndice)', () => {
    const review = (bookingId: string, guardianId: string) =>
      db().query(
        `INSERT INTO reviews (booking_id, teacher_id, guardian_id, rating, comment)
         SELECT b.id, b.teacher_id, o.guardian_id, 5, 'ótima'
           FROM bookings b JOIN orders o ON o.id = b.order_id
          WHERE b.id = $1 AND b.status = 'completed' AND o.guardian_id = $2
         ON CONFLICT (booking_id) DO NOTHING
         RETURNING id`,
        [bookingId, guardianId],
      );

    it('grava a avaliação do responsável que comprou e recusa a segunda', async () => {
      const { bookingId, guardianId } = await completedBooking();
      expect((await review(bookingId, guardianId)).rowCount).toBe(1);
      expect((await review(bookingId, guardianId)).rowCount).toBe(0);
    });

    it('não grava avaliação de outro responsável', async () => {
      const { bookingId } = await completedBooking();
      const other = await insertGuardian(db());
      expect((await review(bookingId, other)).rowCount).toBe(0);
    });

    it('não grava avaliação de aula ainda não concluída', async () => {
      const { teacherId, serviceId } = await teacherWithService();
      const fam = await insertFamilyOrder(db(), teacherId, serviceId);
      const bookingId = await insertBooking(db(), { ...fam, teacherId, serviceId, startsAt: '2026-11-17 14:00-03' });
      expect((await review(bookingId, fam.guardianId)).rowCount).toBe(0);
    });
  });
});

describe('idempotência', () => {
  it('confirmação de pagamento repetida altera 1 linha e depois nenhuma', async () => {
    const { teacherId, serviceId } = await teacherWithService();
    const fam = await insertFamilyOrder(db(), teacherId, serviceId);
    await insertBooking(db(), { ...fam, teacherId, serviceId, startsAt: '2026-11-17 14:00-03', status: 'held' });
    const confirm = () =>
      db().query(
        `UPDATE bookings SET status = 'confirmed', hold_expires_at = NULL
          WHERE order_id = $1 AND status = 'held' RETURNING id`,
        [fam.orderId],
      );
    expect((await confirm()).rowCount).toBe(1);
    expect((await confirm()).rowCount).toBe(0);
  });

  it('notificação de pagamento repetida é gravada uma vez', async () => {
    const eventId = randomUUID();
    const insert = () =>
      db().query(
        `INSERT INTO webhook_events (provider, provider_event_id, payload) VALUES ('fake', $1, '{}'::jsonb)
         ON CONFLICT (provider, provider_event_id) DO NOTHING RETURNING id`,
        [eventId],
      );
    expect((await insert()).rowCount).toBe(1);
    expect((await insert()).rowCount).toBe(0);
    const { rows } = await db().query(`SELECT count(*)::int AS n FROM webhook_events`);
    expect(rows[0]!.n).toBe(1);
  });
});
