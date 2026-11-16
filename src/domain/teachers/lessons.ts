/**
 * Aulas no painel do professor. Reserva ainda não paga não aparece; o
 * endereço da família só aparece depois do pagamento (§3.7); telefone e
 * e-mail da família nunca aparecem.
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { Db } from '@/db/client';
import { instantFromDb } from '@/time/zoned';
import { gradeName, subjectName } from '../catalog';

export interface TeacherLesson {
  bookingId: string;
  startsAt: Temporal.Instant;
  endsAt: Temporal.Instant;
  status: string;
  modality: 'online' | 'at_teacher' | 'at_student';
  subject: string;
  studentFirstName: string;
  studentGrade: string;
  address: string | null;
  checkedIn: boolean;
  outcome: string | null;
}

export async function teacherLessons(db: Db, teacherId: string, now: Temporal.Instant, pastDays = 7): Promise<TeacherLesson[]> {
  const { rows } = await sql<{
    id: string; starts_at: string; ends_at: string; status: string; modality: string; subject: string;
    first_name: string; grade: string | null; address: string | null; checked_in_at: string | null; outcome: string | null;
  }>`
    SELECT b.id, b.starts_at, b.ends_at, b.status, b.modality, sv.subject, st.first_name, st.grade,
           CASE WHEN b.modality = 'at_student' AND b.status IN ('confirmed','completed','no_show')
                THEN concat_ws(', ', a.street || coalesce(', ' || a.number, ''), a.district, a.city || '/' || a.state)
           END AS address,
           ls.checked_in_at, ls.outcome
      FROM bookings b
      JOIN services sv ON sv.id = b.service_id
      JOIN students st ON st.id = b.student_id
      LEFT JOIN addresses a ON a.id = b.address_id
      LEFT JOIN lesson_sessions ls ON ls.booking_id = b.id
     WHERE b.teacher_id = ${teacherId}
       AND b.status IN ('confirmed','completed','no_show','cancelled')
       AND b.ends_at >= ${now.subtract({ hours: 24 * pastDays }).toString()}::timestamptz
     ORDER BY b.starts_at`.execute(db);
  return rows.map((r) => ({
    bookingId: r.id,
    startsAt: instantFromDb(r.starts_at),
    endsAt: instantFromDb(r.ends_at),
    status: r.status,
    modality: r.modality as TeacherLesson['modality'],
    subject: subjectName(r.subject),
    studentFirstName: r.first_name,
    studentGrade: gradeName(r.grade),
    address: r.address,
    checkedIn: r.checked_in_at !== null,
    outcome: r.outcome,
  }));
}
