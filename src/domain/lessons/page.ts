/** Dados da página da aula aberta pelo link da família (sem login de aluno). */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import { instantFromDb } from '@/time/zoned';
import { subjectName } from '../catalog';
import type { Deps } from '../deps';
import { checkinCode } from './checkin';
import { verifyLessonToken } from './links';
import { ROOM_CLOSES_AFTER_MIN, ROOM_OPENS_BEFORE_MIN } from './room';

export interface LessonPageView {
  bookingId: string;
  status: string;
  modality: 'online' | 'at_teacher' | 'at_student';
  startsAt: Temporal.Instant;
  endsAt: Temporal.Instant;
  teacherName: string;
  teacherTimezone: string;
  guardianTimezone: string;
  studentFirstName: string;
  subject: string;
  roomOpen: boolean;
  checkinCode: string | null;
  address: string | null;
}

export async function lessonPageView(deps: Deps, token: string, now: Temporal.Instant): Promise<LessonPageView | null> {
  const t = verifyLessonToken(token, deps.config.sessionSecret, now);
  if (!t) return null;
  const { rows } = await sql<{
    status: string; modality: string; starts_at: string; ends_at: string; t_name: string; t_tz: string; g_tz: string | null;
    first_name: string; subject: string; t_address: string | null; a_street: string | null; a_number: string | null; a_city: string | null;
  }>`
    SELECT b.status, b.modality, b.starts_at, b.ends_at, t.display_name AS t_name, t.timezone AS t_tz, g.timezone AS g_tz,
           st.first_name, sv.subject, t.teaching_address AS t_address, a.street AS a_street, a.number AS a_number, a.city AS a_city
      FROM bookings b JOIN orders o ON o.id = b.order_id JOIN guardians g ON g.id = o.guardian_id
      JOIN teachers t ON t.id = b.teacher_id JOIN students st ON st.id = b.student_id JOIN services sv ON sv.id = b.service_id
      LEFT JOIN addresses a ON a.id = b.address_id
     WHERE b.id = ${t.bookingId}`.execute(deps.db);
  const r = rows[0];
  if (!r) return null;
  const startsAt = instantFromDb(r.starts_at);
  const endsAt = instantFromDb(r.ends_at);
  const modality = r.modality as LessonPageView['modality'];
  const ms = now.epochMilliseconds;
  return {
    bookingId: t.bookingId,
    status: r.status,
    modality,
    startsAt,
    endsAt,
    teacherName: r.t_name,
    teacherTimezone: r.t_tz,
    guardianTimezone: r.g_tz ?? r.t_tz,
    studentFirstName: r.first_name,
    subject: subjectName(r.subject),
    roomOpen: modality === 'online' && r.status === 'confirmed'
      && ms >= startsAt.subtract({ minutes: ROOM_OPENS_BEFORE_MIN }).epochMilliseconds
      && ms <= endsAt.add({ minutes: ROOM_CLOSES_AFTER_MIN }).epochMilliseconds,
    checkinCode: modality === 'online' ? null : checkinCode(t.bookingId, deps.config.sessionSecret),
    address: modality === 'at_teacher' ? r.t_address
      : modality === 'at_student' && r.a_street ? `${r.a_street}${r.a_number ? `, ${r.a_number}` : ''}, ${r.a_city}` : null,
  };
}
