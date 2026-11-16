/**
 * Acréscimos da Fase 1 ao esquema (migração 0005).
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeTestPool, newClient, testPool, truncateAll } from '../helpers/db';
import { insertBooking, insertFamilyOrder, insertService, insertTeacher, pgErrorCode } from '../helpers/fixtures';

const db = () => testPool();
beforeEach(truncateAll);
afterAll(closeTestPool);

async function heldBooking() {
  const teacherId = await insertTeacher(db());
  const serviceId = await insertService(db(), teacherId);
  const fam = await insertFamilyOrder(db(), teacherId, serviceId);
  const bookingId = await insertBooking(db(), {
    ...fam, teacherId, serviceId, startsAt: '2026-11-17 14:00-03', status: 'held',
  });
  return { teacherId, serviceId, bookingId, ...fam };
}

describe('histórico de estados das aulas (booking_events)', () => {
  it('registra a criação e cada mudança de estado, nada mais', async () => {
    const { bookingId } = await heldBooking();
    await db().query(`UPDATE bookings SET status = 'confirmed', hold_expires_at = NULL WHERE id = $1`, [bookingId]);
    await db().query(`UPDATE bookings SET external_event_id = 'ev' WHERE id = $1`, [bookingId]);
    const { rows } = await db().query(
      `SELECT from_status, to_status FROM booking_events WHERE booking_id = $1 ORDER BY id`,
      [bookingId],
    );
    expect(rows).toEqual([
      { from_status: null, to_status: 'held' },
      { from_status: 'held', to_status: 'confirmed' },
    ]);
  });

  it('guarda quem fez a mudança quando a transação informa app.actor', async () => {
    const { bookingId } = await heldBooking();
    const c = await newClient();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('app.actor', 'staff:ana@exemplo.com', true)`);
      await c.query(`UPDATE bookings SET status = 'expired' WHERE id = $1`, [bookingId]);
      await c.query('COMMIT');
    } finally {
      await c.end();
    }
    const { rows } = await db().query(`SELECT actor FROM booking_events WHERE booking_id = $1 AND to_status = 'expired'`, [
      bookingId,
    ]);
    expect(rows).toEqual([{ actor: 'staff:ana@exemplo.com' }]);
  });
});

describe('colunas e tabelas novas', () => {
  it('pedido exige comissão congelada (orders.commission_bps NOT NULL)', async () => {
    const teacherId = await insertTeacher(db());
    const serviceId = await insertService(db(), teacherId);
    const fam = await insertFamilyOrder(db(), teacherId, serviceId);
    const code = await pgErrorCode(
      db().query(
        `INSERT INTO orders (teacher_id, guardian_id, student_id, service_id, total_cents, idempotency_key)
         VALUES ($1, $2, $3, $4, 100, 'x')`,
        [teacherId, fam.guardianId, fam.studentId, serviceId],
      ),
    );
    expect(code).toBe('23502');
  });

  it('um professor tem no máximo uma conta de recebimento', async () => {
    const teacherId = await insertTeacher(db());
    const add = () =>
      db().query(
        `INSERT INTO teacher_payment_accounts (teacher_id, provider, provider_account_id, wallet_id)
         VALUES ($1, 'fake', 'acc', 'wal')`,
        [teacherId],
      );
    await add();
    expect(await pgErrorCode(add())).toBe('23505');
  });

  it('e-mail do professor é único', async () => {
    const a = await insertTeacher(db());
    const b = await insertTeacher(db());
    await db().query(`UPDATE teachers SET email = 'p@exemplo.com' WHERE id = $1`, [a]);
    expect(await pgErrorCode(db().query(`UPDATE teachers SET email = 'p@exemplo.com' WHERE id = $1`, [b]))).toBe('23505');
  });

  it('sessão guarda só o hash do token, único', async () => {
    const add = () =>
      db().query(
        `INSERT INTO sessions (token_hash, subject_type, subject_id, expires_at)
         VALUES ('h', 'teacher', gen_random_uuid(), now() + interval '1 day')`,
      );
    await add();
    expect(await pgErrorCode(add())).toBe('23505');
    expect(
      await pgErrorCode(
        db().query(`INSERT INTO sessions (token_hash, subject_type, subject_id, expires_at)
                    VALUES ('h2', 'student', gen_random_uuid(), now())`),
      ),
    ).toBe('23514'); // aluno não tem login
  });

  it('código presencial começa sem tentativas', async () => {
    const { bookingId } = await heldBooking();
    await db().query(`INSERT INTO lesson_sessions (booking_id) VALUES ($1)`, [bookingId]);
    const { rows } = await db().query(`SELECT checkin_attempts FROM lesson_sessions WHERE booking_id = $1`, [bookingId]);
    expect(rows[0]!.checkin_attempts).toBe(0);
  });

  it('calendário conectado: uma conexão por professor e provedor', async () => {
    const teacherId = await insertTeacher(db());
    const add = () =>
      db().query(`INSERT INTO calendar_connections (teacher_id, provider) VALUES ($1, 'fake')`, [teacherId]);
    await add();
    expect(await pgErrorCode(add())).toBe('23505');
  });
});
