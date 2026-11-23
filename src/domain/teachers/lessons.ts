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
  /** Falta do aluno com o valor ainda retido: até quando o professor pode devolvê-lo. */
  refundableUntil: Temporal.Instant | null;
  /** Quanto o responsável recebe de volta se o professor devolver. */
  refundCents: number | null;
  /** O professor devolveu o valor desta aula (falta justificada). */
  refunded: boolean;
  /** Aula de um horário fixo semanal da família. */
  weekly: boolean;
}

export async function teacherLessons(db: Db, teacherId: string, now: Temporal.Instant, pastDays = 7): Promise<TeacherLesson[]> {
  const { rows } = await sql<{
    id: string; starts_at: string; ends_at: string; status: string; modality: string; subject: string;
    first_name: string; grade: string | null; address: string | null; checked_in_at: string | null; outcome: string | null;
    payout_status: string | null; release_after: string | null; gross_cents: number | null; series_id: string | null;
  }>`
    SELECT b.id, b.starts_at, b.ends_at, b.status, b.modality, sv.subject, st.first_name, st.grade,
           CASE WHEN b.modality = 'at_student' AND b.status IN ('confirmed','completed','no_show')
                THEN concat_ws(', ', a.street || coalesce(', ' || a.number, ''), a.district, a.city || '/' || a.state)
           END AS address,
           ls.checked_in_at, ls.outcome, po.status AS payout_status, po.release_after, po.gross_cents, b.series_id
      FROM bookings b
      JOIN services sv ON sv.id = b.service_id
      JOIN students st ON st.id = b.student_id
      LEFT JOIN addresses a ON a.id = b.address_id
      LEFT JOIN lesson_sessions ls ON ls.booking_id = b.id
      LEFT JOIN payouts po ON po.booking_id = b.id
     WHERE b.teacher_id = ${teacherId}
       AND b.status IN ('confirmed','completed','no_show','cancelled')
       AND b.ends_at >= ${now.subtract({ hours: 24 * pastDays }).toString()}::timestamptz
     ORDER BY b.starts_at`.execute(db);
  const refundableUntil = (r: (typeof rows)[number]) => {
    if (r.status !== 'no_show' || r.payout_status !== 'held' || !r.release_after) return null;
    const until = instantFromDb(r.release_after);
    return until.epochMilliseconds > now.epochMilliseconds ? until : null;
  };
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
    refundableUntil: refundableUntil(r),
    refundCents: r.status === 'no_show' && r.payout_status === 'held' ? r.gross_cents : null,
    refunded: r.status === 'no_show' && r.payout_status === 'refunded',
    weekly: r.series_id !== null,
  }));
}

/**
 * As abas da tela Aulas. Próximas: confirmadas que ainda não terminaram (a em
 * andamento inclusive), a mais perto primeiro. Anteriores: todo o resto, a mais
 * recente primeiro.
 */
export function splitLessons(lessons: TeacherLesson[], now: Temporal.Instant): { upcoming: TeacherLesson[]; past: TeacherLesson[] } {
  const ahead = (l: TeacherLesson) => l.status === 'confirmed' && l.endsAt.epochMilliseconds > now.epochMilliseconds;
  const by = (l: TeacherLesson) => l.startsAt.epochMilliseconds;
  return {
    upcoming: lessons.filter(ahead).sort((a, b) => by(a) - by(b)),
    past: lessons.filter((l) => !ahead(l)).sort((a, b) => by(b) - by(a)),
  };
}
