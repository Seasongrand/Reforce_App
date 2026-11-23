/**
 * Listas do painel da equipe (§3.7): professores por situação, aulas de hoje e
 * reembolsos. Só leitura; nenhuma regra de aula, repasse ou devolução aqui.
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { Db } from '@/db/client';
import { instantFromDb } from '@/time/zoned';
import { subjectName } from '../catalog';

export const TEACHER_STATUSES = ['draft', 'in_review', 'approved', 'paused', 'suspended'] as const;
export type TeacherStatus = (typeof TEACHER_STATUSES)[number];

export interface StaffTeacher {
  id: string;
  name: string;
  email: string | null;
  slug: string;
  status: TeacherStatus;
  createdAt: Temporal.Instant;
}

/** Quantos professores há em cada situação e a lista toda, os mais novos primeiro. */
export async function teachersByStatus(db: Db): Promise<{ counts: Record<TeacherStatus, number>; teachers: StaffTeacher[] }> {
  const rows = await db.selectFrom('teachers').select(['id', 'display_name', 'email', 'slug', 'status', 'created_at'])
    .orderBy('created_at', 'desc').execute();
  const counts = Object.fromEntries(TEACHER_STATUSES.map((s) => [s, 0])) as Record<TeacherStatus, number>;
  for (const r of rows) counts[r.status as TeacherStatus] += 1;
  return {
    counts,
    teachers: rows.map((r) => ({
      id: r.id, name: r.display_name, email: r.email, slug: r.slug,
      status: r.status as TeacherStatus, createdAt: instantFromDb(r.created_at),
    })),
  };
}

export interface DayLesson {
  bookingId: string;
  startsAt: Temporal.Instant;
  teacherName: string;
  studentFirstName: string;
  subject: string;
  modality: 'online' | 'at_teacher' | 'at_student';
  status: 'confirmed' | 'completed' | 'no_show' | 'cancelled';
  checkedIn: boolean;
}

/** Aulas pagas (inclusive canceladas e faltas) que começam no dia de `now` em `tz`, por horário. */
export async function lessonsOfDay(db: Db, now: Temporal.Instant, tz = 'America/Sao_Paulo'): Promise<DayLesson[]> {
  const { rows } = await sql<{
    id: string; starts_at: string; display_name: string; first_name: string; subject: string;
    modality: DayLesson['modality']; status: DayLesson['status']; checked_in_at: string | null;
  }>`
    WITH day AS (SELECT date_trunc('day', ${now.toString()}::timestamptz AT TIME ZONE ${tz}) AS d)
    SELECT b.id, b.starts_at, t.display_name, st.first_name, sv.subject, b.modality, b.status, ls.checked_in_at
      FROM bookings b
      JOIN teachers t ON t.id = b.teacher_id
      JOIN students st ON st.id = b.student_id
      JOIN services sv ON sv.id = b.service_id
      LEFT JOIN lesson_sessions ls ON ls.booking_id = b.id
      CROSS JOIN day
     WHERE b.status IN ('confirmed','completed','no_show','cancelled')
       AND b.starts_at >= day.d AT TIME ZONE ${tz}
       AND b.starts_at < (day.d + interval '1 day') AT TIME ZONE ${tz}
     ORDER BY b.starts_at`.execute(db);
  return rows.map((r) => ({
    bookingId: r.id,
    startsAt: instantFromDb(r.starts_at),
    teacherName: r.display_name,
    studentFirstName: r.first_name,
    subject: subjectName(r.subject),
    modality: r.modality,
    status: r.status,
    checkedIn: r.checked_in_at !== null,
  }));
}

export type RefundReason = 'teacher_no_show' | 'dispute' | 'student_excused' | 'student_no_show' | 'late_payment';

export interface RefundItem {
  orderId: string;
  paidAt: Temporal.Instant;
  guardianName: string;
  teacherName: string;
  amountCents: number;
  /** Quanto o provedor já devolveu; 0 enquanto a devolução não foi feita. */
  refundedCents: number;
  reason: RefundReason;
}

/**
 * Pedidos com devolução decidida (toda ou parte), os mais recentes primeiro.
 * Motivo, nesta ordem: falta do professor; contestação aceita; falta do aluno justificada pelo
 * professor (repasse devolvido); falta do aluno (o que não ficou com o
 * professor); senão, pagamento depois do prazo.
 */
export async function refundList(db: Db, limit = 50): Promise<RefundItem[]> {
  const { rows } = await sql<{
    order_id: string; paid_at: string; guardian: string; teacher: string; amount_cents: number; refunded_cents: number;
    teacher_no_show: boolean; dispute: boolean; excused: boolean; no_show: boolean;
  }>`
    SELECT o.id AS order_id, coalesce(p.paid_at, p.created_at) AS paid_at, g.name AS guardian, t.display_name AS teacher,
           p.amount_cents, p.refunded_cents,
           EXISTS (SELECT 1 FROM bookings b JOIN lesson_sessions ls ON ls.booking_id = b.id
                    WHERE b.order_id = o.id AND ls.outcome = 'teacher_no_show') AS teacher_no_show,
           EXISTS (SELECT 1 FROM bookings b JOIN disputes d ON d.booking_id = b.id
                    WHERE b.order_id = o.id AND d.status = 'for_guardian') AS dispute,
           EXISTS (SELECT 1 FROM bookings b JOIN payouts po ON po.booking_id = b.id
                    WHERE b.order_id = o.id AND po.status = 'refunded') AS excused,
           EXISTS (SELECT 1 FROM bookings b WHERE b.order_id = o.id AND b.status = 'no_show') AS no_show
      FROM orders o
      JOIN guardians g ON g.id = o.guardian_id
      JOIN teachers t ON t.id = o.teacher_id
      JOIN LATERAL (
        SELECT * FROM payments WHERE order_id = o.id AND status IN ('paid','refunded')
         ORDER BY paid_at DESC NULLS LAST LIMIT 1
      ) p ON true
     WHERE o.status IN ('refunded','partially_refunded')
     ORDER BY coalesce(p.paid_at, p.created_at) DESC
     LIMIT ${limit}`.execute(db);
  return rows.map((r) => ({
    orderId: r.order_id,
    paidAt: instantFromDb(r.paid_at),
    guardianName: r.guardian,
    teacherName: r.teacher,
    amountCents: r.amount_cents,
    refundedCents: r.refunded_cents,
    reason: r.teacher_no_show ? 'teacher_no_show' : r.dispute ? 'dispute' : r.excused ? 'student_excused' : r.no_show ? 'student_no_show' : 'late_payment',
  }));
}
