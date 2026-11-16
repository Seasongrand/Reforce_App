import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import type { Db } from '@/db/client';
import { instantFromDb } from '@/time/zoned';
import { recordCall } from '../dev-log';
import { SimulatedFailure } from '../errors';
import type { CalendarConnectionRef, CalendarProvider, Interval } from './types';

/** Compromissos vêm de dev_calendar_busy (cadastrados em /dev). */
export class FakeCalendarProvider implements CalendarProvider {
  readonly name = 'fake';
  private readonly failOn: Set<string>;

  constructor(private readonly db: Db, opts: { failOn?: string[] } = {}) {
    this.failOn = new Set(opts.failOn ?? []);
  }

  async freeBusy(conn: CalendarConnectionRef, range: Interval): Promise<Interval[]> {
    if (this.failOn.has('freeBusy')) throw new SimulatedFailure('freeBusy');
    const { rows } = await sql<{ s: string; e: string }>`
      SELECT lower(during) AS s, upper(during) AS e FROM dev_calendar_busy
       WHERE teacher_id = ${conn.teacherId}
         AND during && tstzrange(${range.start.toString()}::timestamptz, ${range.end.toString()}::timestamptz, '[)')
       ORDER BY lower(during)`.execute(this.db);
    return rows.map((r) => ({ start: instantFromDb(r.s), end: instantFromDb(r.e) }));
  }

  async createEvent(conn: CalendarConnectionRef, ev: { bookingId: string }) {
    if (this.failOn.has('createEvent')) throw new SimulatedFailure('createEvent');
    const eventId = `fake_ev_${randomUUID()}`;
    await recordCall(this.db, this.name, 'createEvent', eventId, { teacherId: conn.teacherId, bookingId: ev.bookingId });
    return { eventId };
  }

  async deleteEvent(conn: CalendarConnectionRef, eventId: string) {
    await recordCall(this.db, this.name, 'deleteEvent', eventId, { teacherId: conn.teacherId });
  }
}
