/**
 * Apêndice: fuso, conciliação e horários livres (§2.1 e §2.3).
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import {
  freeSlots,
  insertBooking,
  insertFamilyOrder,
  insertRule,
  insertService,
  insertTeacher,
  pgErrorCode,
  sp,
} from '../helpers/fixtures';

const db = () => testPool();
beforeEach(truncateAll);
afterAll(closeTestPool);

describe('hora local + 7 dias contra instante + 168 horas (regras de 2018)', () => {
  it('no PostgreSQL: 14h contra 15h', async () => {
    const { rows } = await db().query(`
      SELECT (timestamp '2018-10-30 14:00' AT TIME ZONE 'America/Sao_Paulo') AS first,
             ((timestamp '2018-10-30 14:00' + interval '7 days') AT TIME ZONE 'America/Sao_Paulo') AS local_week,
             to_char(((timestamp '2018-10-30 14:00' AT TIME ZONE 'America/Sao_Paulo') + interval '168 hours')
                       AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') AS instant_week_local`);
    expect((rows[0]!.first as Date).toISOString()).toBe('2018-10-30T17:00:00.000Z');
    expect((rows[0]!.local_week as Date).toISOString()).toBe('2018-11-06T16:00:00.000Z');
    expect(rows[0]!.instant_week_local).toBe('15:00');
  });
});

describe('conciliação quando a base de fusos muda (§2.1)', () => {
  it('lista só a aula cujo instante deixou de corresponder à hora combinada', async () => {
    const teacherId = await insertTeacher(db());
    const serviceId = await insertService(db(), teacherId);
    const fam = await insertFamilyOrder(db(), teacherId, serviceId);
    const id = await insertBooking(db(), { ...fam, teacherId, serviceId, startsAt: '2026-11-17 14:00-03' });
    expect((await db().query(`SELECT id FROM bookings_tz_drift`)).rows).toEqual([]);
    await db().query(
      `UPDATE bookings SET starts_at = starts_at + interval '1 hour', ends_at = ends_at + interval '1 hour',
              blocked = tstzrange(lower(blocked) + interval '1 hour', upper(blocked) + interval '1 hour', '[)')
        WHERE id = $1`,
      [id],
    );
    expect((await db().query(`SELECT id FROM bookings_tz_drift`)).rows).toEqual([{ id }]);
  });
});

describe('horários livres (free_slots)', () => {
  it('com aula paga, compromisso externo e bloqueio de dia inteiro devolve os 8 horários esperados', async () => {
    const teacherId = await insertTeacher(db());
    const serviceId = await insertService(db(), teacherId);
    await insertRule(db(), teacherId, 2, '14:00', '18:00'); // terça
    await insertRule(db(), teacherId, 4, '09:00', '12:00'); // quinta
    const fam = await insertFamilyOrder(db(), teacherId, serviceId);
    await insertBooking(db(), { ...fam, teacherId, serviceId, startsAt: '2026-11-17 14:00-03' });
    await db().query(
      `INSERT INTO external_busy (teacher_id, calendar_ref, provider_event_id, during)
       VALUES ($1, 'primary', 'ev1', tstzrange('2026-11-17 16:30-03', '2026-11-17 17:00-03', '[)'))`,
      [teacherId],
    );
    await db().query(
      `INSERT INTO availability_overrides (teacher_id, on_date, kind) VALUES ($1, '2026-11-24', 'block')`,
      [teacherId],
    );
    const slots = await freeSlots(db(), teacherId, serviceId, '2026-11-16', '2026-11-24', '2026-11-16 08:00-03');
    expect(slots).toEqual(
      [
        '2026-11-17 15:00',
        '2026-11-17 15:30',
        '2026-11-17 17:00',
        '2026-11-19 09:00',
        '2026-11-19 09:30',
        '2026-11-19 10:00',
        '2026-11-19 10:30',
        '2026-11-19 11:00',
      ].map(sp),
    );
  });

  it('reserva temporária válida ocupa; vencida não ocupa', async () => {
    const teacherId = await insertTeacher(db());
    const serviceId = await insertService(db(), teacherId);
    await insertRule(db(), teacherId, 2, '14:00', '16:00');
    const now = '2026-11-16 08:00-03';
    const a = await insertFamilyOrder(db(), teacherId, serviceId);
    await insertBooking(db(), {
      ...a, teacherId, serviceId, startsAt: '2026-11-17 14:00-03', status: 'held', holdExpiresAt: '2026-11-16 08:05-03',
    });
    expect(await freeSlots(db(), teacherId, serviceId, '2026-11-17', '2026-11-17', now)).toEqual([sp('2026-11-17 15:00')]);
    expect(await freeSlots(db(), teacherId, serviceId, '2026-11-17', '2026-11-17', '2026-11-16 08:06-03')).toEqual(
      ['2026-11-17 14:00', '2026-11-17 14:30', '2026-11-17 15:00'].map(sp),
    );
  });

  it('com antecedência mínima de 2 horas, consulta às 15h oferece primeiro as 17h', async () => {
    const teacherId = await insertTeacher(db(), { min_notice_min: 120 });
    const serviceId = await insertService(db(), teacherId);
    await insertRule(db(), teacherId, 2, '14:00', '18:00');
    const slots = await freeSlots(db(), teacherId, serviceId, '2026-11-17', '2026-11-17', '2026-11-17 15:00-03');
    expect(slots[0]).toBe(sp('2026-11-17 17:00'));
  });

  it('presencial com 30 min de deslocamento: depois da online das 14h às 15h10, recusa 15h30, aceita 16h; a seguinte só às 18h', async () => {
    const teacherId = await insertTeacher(db());
    const online = await insertService(db(), teacherId, { buffer_after_min: 10 });
    const presencial = await insertService(db(), teacherId, {
      modality: 'at_teacher', buffer_before_min: 30, buffer_after_min: 30,
    });
    await insertRule(db(), teacherId, 2, '14:00', '20:00');
    const now = '2026-11-16 08:00-03';
    const fam1 = await insertFamilyOrder(db(), teacherId, online);
    await insertBooking(db(), { ...fam1, teacherId, serviceId: online, startsAt: '2026-11-17 14:00-03', bufferAfterMin: 10 });

    const offered = await freeSlots(db(), teacherId, presencial, '2026-11-17', '2026-11-17', now);
    expect(offered).not.toContain(sp('2026-11-17 15:30'));
    expect(offered[0]).toBe(sp('2026-11-17 16:00'));

    const presencialAt = async (startsAt: string) => {
      const fam = await insertFamilyOrder(db(), teacherId, presencial);
      return insertBooking(db(), {
        ...fam, teacherId, serviceId: presencial, startsAt, modality: 'at_teacher', bufferBeforeMin: 30, bufferAfterMin: 30,
      });
    };
    expect(await pgErrorCode(presencialAt('2026-11-17 15:30-03'))).toBe('23P01');
    await presencialAt('2026-11-17 16:00-03');

    const after = await freeSlots(db(), teacherId, presencial, '2026-11-17', '2026-11-17', now);
    expect(after[0]).toBe(sp('2026-11-17 18:00'));
  });
});
