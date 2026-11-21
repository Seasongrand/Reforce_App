/** Tarefas avulsas do worker, enfileiradas na confirmação da aula. */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import { instantFromDb } from '@/time/zoned';
import { subjectName } from './catalog';
import type { Deps } from './deps';

export async function createVideoRoom(deps: Deps, bookingId: string, _now: Temporal.Instant): Promise<void> {
  const b = await deps.db.selectFrom('bookings')
    .innerJoin('lesson_sessions', 'lesson_sessions.booking_id', 'bookings.id')
    .select(['bookings.starts_at', 'bookings.ends_at', 'bookings.modality', 'lesson_sessions.video_room'])
    .where('bookings.id', '=', bookingId).executeTakeFirst();
  if (!b || b.modality !== 'online' || b.video_room) return;
  const { roomName } = await deps.providers.video.createRoom({
    bookingId, startsAt: instantFromDb(b.starts_at), endsAt: instantFromDb(b.ends_at),
  });
  await sql`UPDATE lesson_sessions SET video_room = ${roomName} WHERE booking_id = ${bookingId} AND video_room IS NULL`
    .execute(deps.db);
}

/** Evento no calendário próprio "Aulas" do professor (§3.3). */
export async function createCalendarEvent(deps: Deps, bookingId: string, _now: Temporal.Instant): Promise<void> {
  const b = await deps.db.selectFrom('bookings')
    .innerJoin('services', 'services.id', 'bookings.service_id')
    .innerJoin('students', 'students.id', 'bookings.student_id')
    .select(['bookings.teacher_id', 'bookings.starts_at', 'bookings.ends_at', 'bookings.external_event_id',
      'services.subject', 'students.first_name'])
    .where('bookings.id', '=', bookingId).executeTakeFirst();
  if (!b || b.external_event_id) return;
  const conn = await deps.db.selectFrom('calendar_connections').select('id')
    .where('teacher_id', '=', b.teacher_id).where('status', '=', 'active').executeTakeFirst();
  if (!conn) return;
  const { eventId } = await deps.providers.calendar.createEvent(
    { teacherId: b.teacher_id, connectionId: conn.id },
    {
      bookingId,
      title: `Aula de ${subjectName(b.subject)} (${b.first_name})`,
      start: instantFromDb(b.starts_at),
      end: instantFromDb(b.ends_at),
      url: `${deps.config.appBaseUrl}/professor/aulas`,
    },
  );
  await sql`UPDATE bookings SET external_event_id = ${eventId} WHERE id = ${bookingId} AND external_event_id IS NULL`
    .execute(deps.db);
}

/** Tira do calendário do professor o evento de uma aula cancelada ou remarcada. */
export async function deleteCalendarEvent(deps: Deps, bookingId: string, _now: Temporal.Instant): Promise<void> {
  const b = await deps.db.selectFrom('bookings').select(['teacher_id', 'external_event_id', 'status'])
    .where('id', '=', bookingId).executeTakeFirst();
  if (!b?.external_event_id || b.status === 'confirmed') return;
  const conn = await deps.db.selectFrom('calendar_connections').select('id')
    .where('teacher_id', '=', b.teacher_id).where('status', '=', 'active').executeTakeFirst();
  if (!conn) return;
  await deps.providers.calendar.deleteEvent({ teacherId: b.teacher_id, connectionId: conn.id }, b.external_event_id);
  await sql`UPDATE bookings SET external_event_id = NULL WHERE id = ${bookingId}`.execute(deps.db);
}

/** Retrato do próximo horário e índice de busca do professor (§2.5). */
export async function refreshTeacher(deps: Deps, teacherId: string, now: Temporal.Instant): Promise<void> {
  await sql`SELECT refresh_next_slot(${teacherId}, ${now.toString()}::timestamptz)`.execute(deps.db);
  await sql`SELECT refresh_teacher_search(${teacherId})`.execute(deps.db);
}

/** Varredura periódica: o tempo passa e o próximo horário deixa de valer. */
export async function refreshAllListed(deps: Deps, now: Temporal.Instant): Promise<number> {
  const { rows } = await sql<{ id: string }>`SELECT id FROM teachers_listed`.execute(deps.db);
  for (const r of rows) await refreshTeacher(deps, r.id, now);
  return rows.length;
}
