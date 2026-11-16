/**
 * Tarefas avulsas do worker e a ligação com o Graphile Worker.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createCalendarEvent, createVideoRoom, refreshTeacher } from '@/domain/jobs';
import { runQueuedJobsOnce } from '@/worker/tasks';
import { appDb, closeAppDb } from '../helpers/app';
import { closeTestPool, queuedJobs, testPool, truncateAll, TEST_DATABASE_URL } from '../helpers/db';
import { NOW, paidLesson, testDeps } from '../helpers/scenario';
import { fixedClock } from '@/time/clock';

beforeEach(truncateAll);
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = () => testDeps();

describe('tarefas avulsas', () => {
  it('cria a sala de vídeo uma vez só', async () => {
    const l = await paidLesson();
    await createVideoRoom(deps(), l.bookingId, NOW);
    await createVideoRoom(deps(), l.bookingId, NOW);
    const { rows } = await testPool().query(`SELECT video_room FROM lesson_sessions WHERE booking_id = $1`, [l.bookingId]);
    expect(rows[0]!.video_room).toBe(`fake-room-${l.bookingId}`);
    const calls = await testPool().query(`SELECT count(*)::int AS n FROM dev_provider_calls WHERE operation = 'createRoom'`);
    expect(calls.rows[0]!.n).toBe(1);
  });

  it('cria o evento no calendário "Aulas" e guarda o id na aula', async () => {
    const l = await paidLesson();
    await testPool().query(`INSERT INTO calendar_connections (teacher_id, provider) VALUES ($1, 'fake')`, [l.teacherId]);
    await createCalendarEvent(deps(), l.bookingId, NOW);
    await createCalendarEvent(deps(), l.bookingId, NOW);
    const { rows } = await testPool().query(`SELECT external_event_id FROM bookings WHERE id = $1`, [l.bookingId]);
    expect(rows[0]!.external_event_id).toMatch(/^fake_ev_/);
    const calls = await testPool().query(`SELECT count(*)::int AS n FROM dev_provider_calls WHERE operation = 'createEvent'`);
    expect(calls.rows[0]!.n).toBe(1);
  });

  it('refaz o retrato do próximo horário e o índice de busca', async () => {
    const l = await paidLesson();
    await refreshTeacher(deps(), l.teacherId, NOW);
    const { rows } = await testPool().query(
      `SELECT next_slot_at FROM teacher_next_slot WHERE teacher_id = $1 AND modality = 'online'`,
      [l.teacherId],
    );
    expect((rows[0]!.next_slot_at as Date).toISOString()).toBe('2026-11-17T18:00:00.000Z'); // 14h vendida → 15h
    const s = await testPool().query(`SELECT 1 FROM teacher_search WHERE teacher_id = $1`, [l.teacherId]);
    expect(s.rows).toHaveLength(1);
  });
});

describe('worker', () => {
  it('processa as tarefas enfileiradas pela confirmação', async () => {
    const l = await paidLesson();
    expect((await queuedJobs()).map((j) => j.task)).toEqual(expect.arrayContaining(['video.create_room']));
    await runQueuedJobsOnce(TEST_DATABASE_URL, () => deps(), fixedClock(NOW));
    expect(await queuedJobs()).toEqual([]);
    const { rows } = await testPool().query(`SELECT video_room FROM lesson_sessions WHERE booking_id = $1`, [l.bookingId]);
    expect(rows[0]!.video_room).toBeTruthy();
    void appDb;
  });
});

describe('agenda do worker', () => {
  it('o crontab é aceito pelo Graphile Worker e aponta para tarefas existentes', async () => {
    const { parseCrontab } = await import('graphile-worker');
    const { CRONTAB, buildTaskList } = await import('@/worker/tasks');
    const items = parseCrontab(CRONTAB);
    const tasks = Object.keys(buildTaskList(() => testDeps(), () => fixedClock(NOW)));
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(tasks).toContain(item.task);
  });
});
