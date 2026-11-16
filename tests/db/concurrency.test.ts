/**
 * Apêndice §2.4: concorrência da reserva, com conexões reais e simultâneas.
 * O SQL de reserva é o do bloco "Reserva temporária" do apêndice.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { Temporal } from 'temporal-polyfill';
import { weeklyOccurrences } from '@/time/recurrence';
import { raceN } from '../helpers/concurrency';
import { closeTestPool, newClient, testPool, truncateAll } from '../helpers/db';
import { insertBooking, insertFamilyOrder, insertService, insertTeacher, pgErrorCode } from '../helpers/fixtures';

const db = () => testPool();
beforeEach(truncateAll);
afterAll(closeTestPool);

interface Slot {
  teacherId: string;
  serviceId: string;
  orderId: string;
  studentId: string;
  localStart: string; // hora de parede, sem fuso
  duration: number;
  bufferBefore: number;
  bufferAfter: number;
}

const LOCK = `SELECT pg_advisory_xact_lock(hashtextextended('teacher:' || $1, 0))`;

const EXPIRE_IN_PATH = `
UPDATE bookings b SET status = 'expired'
  FROM teachers t
 WHERE t.id = $1 AND b.teacher_id = t.id
   AND b.status = 'held' AND b.hold_expires_at < now()
   AND b.blocked && tstzrange(
         ($2::timestamp AT TIME ZONE t.timezone) - make_interval(mins => $3::int),
         ($2::timestamp AT TIME ZONE t.timezone) + make_interval(mins => $4::int + $5::int), '[)')`;

const OVERLAP_EXISTS = `
SELECT EXISTS (
  SELECT 1 FROM bookings b, teachers t
   WHERE t.id = $1 AND b.teacher_id = t.id AND b.status IN ('held','confirmed')
     AND b.blocked && tstzrange(
           ($2::timestamp AT TIME ZONE t.timezone) - make_interval(mins => $3::int),
           ($2::timestamp AT TIME ZONE t.timezone) + make_interval(mins => $4::int + $5::int), '[)')
) AS taken`;

const INSERT_HOLD = `
INSERT INTO bookings (order_id, teacher_id, student_id, service_id,
                      starts_at, ends_at, blocked, local_start, timezone,
                      status, hold_expires_at)
SELECT $6, t.id, $7, $8,
       s, s + make_interval(mins => $4::int),
       tstzrange(s - make_interval(mins => $3::int),
                 s + make_interval(mins => $4::int + $5::int), '[)'),
       $2::timestamp, t.timezone,
       'held', now() + make_interval(mins => 10)
  FROM teachers t,
       LATERAL (SELECT $2::timestamp AT TIME ZONE t.timezone AS s) x
 WHERE t.id = $1`;

const params = (s: Slot) => [s.teacherId, s.localStart, s.bufferBefore, s.duration, s.bufferAfter];
const insertParams = (s: Slot) => [...params(s), s.orderId, s.studentId, s.serviceId];

async function setup(n: number) {
  const teacherId = await insertTeacher(db());
  const serviceId = await insertService(db(), teacherId);
  const families = [];
  for (let i = 0; i < n; i++) families.push(await insertFamilyOrder(db(), teacherId, serviceId));
  const slot = (i: number, localStart = '2026-11-17 14:00'): Slot => ({
    teacherId, serviceId, orderId: families[i]!.orderId, studentId: families[i]!.studentId,
    localStart, duration: 60, bufferBefore: 0, bufferAfter: 0,
  });
  return { teacherId, serviceId, families, slot };
}

const activeCount = async (teacherId: string) =>
  (await db().query(`SELECT count(*)::int AS n FROM bookings WHERE teacher_id = $1 AND status IN ('held','confirmed')`, [
    teacherId,
  ])).rows[0]!.n;

describe('20 sessões simultâneas no mesmo horário', () => {
  it('só com a restrição: 1 grava e 19 recebem 23P01', async () => {
    const { teacherId, slot } = await setup(20);
    const results = await raceN(20, async (c, i, ready) => {
      await c.query('BEGIN');
      await ready();
      await c.query(INSERT_HOLD, insertParams(slot(i)));
      await c.query('COMMIT');
      return 'ok';
    });
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const failures = results.filter((r) => !r.ok);
    expect(failures).toHaveLength(19);
    expect(failures.every((r) => !r.ok && r.code === '23P01')).toBe(true);
    expect(await activeCount(teacherId)).toBe(1);
  });

  it('com trava por professor e verificação prévia: 1 grava e 19 recebem "ocupado", sem erro', async () => {
    const { teacherId, slot } = await setup(20);
    const results = await raceN(20, async (c, i, ready) => {
      const s = slot(i);
      await c.query('BEGIN');
      await ready();
      await c.query(LOCK, [s.teacherId]);
      await c.query(EXPIRE_IN_PATH, params(s));
      const { rows } = await c.query<{ taken: boolean }>(OVERLAP_EXISTS, params(s));
      if (rows[0]!.taken) {
        await c.query('ROLLBACK');
        return 'ocupado';
      }
      await c.query(INSERT_HOLD, insertParams(s));
      await c.query('COMMIT');
      return 'ok';
    });
    expect(results.every((r) => r.ok)).toBe(true);
    const values = results.map((r) => (r.ok ? r.value : 'erro'));
    expect(values.filter((v) => v === 'ok')).toHaveLength(1);
    expect(values.filter((v) => v === 'ocupado')).toHaveLength(19);
    expect(await activeCount(teacherId)).toBe(1);
  });
});

describe('reserva temporária vencida', () => {
  it('bloqueia até virar expired; a limpeza na mesma transação libera o horário', async () => {
    const { teacherId, serviceId, families, slot } = await setup(2);
    const staleId = await insertBooking(db(), {
      ...families[0]!, teacherId, serviceId, startsAt: '2026-11-17 14:00-03',
      status: 'held', holdExpiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    // sem a limpeza, o INSERT direto ainda colide com a reserva vencida
    expect(await pgErrorCode(db().query(INSERT_HOLD, insertParams(slot(1))))).toBe('23P01');

    const c = await newClient();
    try {
      await c.query('BEGIN');
      await c.query(LOCK, [teacherId]);
      await c.query(EXPIRE_IN_PATH, params(slot(1)));
      await c.query(INSERT_HOLD, insertParams(slot(1)));
      await c.query('COMMIT');
    } finally {
      await c.end();
    }
    const { rows } = await db().query(`SELECT status FROM bookings WHERE id = $1`, [staleId]);
    expect(rows[0]!.status).toBe('expired');
    expect(await activeCount(teacherId)).toBe(1);
  });
});

describe('pacote de 4 semanas', () => {
  it('com conflito na terceira semana, a transação é desfeita e nenhuma aula fica gravada', async () => {
    const { teacherId, serviceId, families, slot } = await setup(2);
    // a terceira ocorrência (01/12, 14h) já está vendida para outra família
    await insertBooking(db(), { ...families[1]!, teacherId, serviceId, startsAt: '2026-12-01 14:00-03' });
    const dates = weeklyOccurrences(Temporal.PlainDateTime.from('2026-11-17T14:00'), 4).map((d) =>
      d.toString().replace('T', ' '),
    );
    const c: pg.Client = await newClient();
    let code: string | undefined;
    try {
      await c.query('BEGIN');
      await c.query(LOCK, [teacherId]);
      for (const localStart of dates) {
        await c.query(INSERT_HOLD, insertParams(slot(0, localStart)));
      }
      await c.query('COMMIT');
    } catch (err) {
      code = (err as { code?: string }).code;
      await c.query('ROLLBACK');
    } finally {
      await c.end();
    }
    expect(code).toBe('23P01');
    const { rows } = await db().query(`SELECT count(*)::int AS n FROM bookings WHERE order_id = $1`, [
      families[0]!.orderId,
    ]);
    expect(rows[0]!.n).toBe(0);
  });
});
