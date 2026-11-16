import type { Temporal } from 'temporal-polyfill';

export interface CalendarConnectionRef {
  teacherId: string;
  connectionId: string;
}

export interface Interval {
  start: Temporal.Instant;
  end: Temporal.Instant;
}

/**
 * Calendário externo (§3.3): livre/ocupado sem título nem participantes, e um
 * calendário próprio "Aulas" onde a plataforma cria os eventos das aulas.
 */
export interface CalendarProvider {
  readonly name: string;
  freeBusy(conn: CalendarConnectionRef, range: Interval): Promise<Interval[]>;
  createEvent(
    conn: CalendarConnectionRef,
    ev: { bookingId: string; title: string; start: Temporal.Instant; end: Temporal.Instant; url: string },
  ): Promise<{ eventId: string }>;
  deleteEvent(conn: CalendarConnectionRef, eventId: string): Promise<void>;
}
