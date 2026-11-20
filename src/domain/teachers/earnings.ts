/**
 * Meus ganhos (Recebimento): só lê a tabela de repasses, sem refazer contas.
 * "A receber" é o que ainda está retido ou em liberação; "liberado" separa o
 * mês corrente (no fuso do professor) do total. Repasse devolvido ao aluno
 * (falta justificada) aparece na lista, mas fica fora das somas.
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { Db } from '@/db/client';
import { instantFromDb } from '@/time/zoned';
import { subjectName } from '../catalog';

export type PayoutStatus = 'held' | 'releasing' | 'released' | 'refunded';

export interface EarningItem {
  bookingId: string;
  startsAt: Temporal.Instant;
  subject: string;
  studentFirstName: string;
  grossCents: number;
  commissionBps: number;
  teacherCents: number;
  status: PayoutStatus;
  releaseAfter: Temporal.Instant;
  releasedAt: Temporal.Instant | null;
}

export interface TeacherEarnings {
  pendingCents: number;
  pendingCount: number;
  releasedMonthCents: number;
  releasedTotalCents: number;
  /** Mais recentes primeiro, até 30. */
  items: EarningItem[];
}

const ITEMS = 30;

export async function teacherEarnings(db: Db, teacherId: string, now: Temporal.Instant): Promise<TeacherEarnings> {
  const at = now.toString();
  const { rows: [sum] } = await sql<{
    pending_cents: string; pending_count: string; released_month_cents: string; released_total_cents: string;
  }>`
    SELECT coalesce(sum(po.teacher_cents) FILTER (WHERE po.status IN ('held','releasing')), 0) AS pending_cents,
           count(*) FILTER (WHERE po.status IN ('held','releasing')) AS pending_count,
           coalesce(sum(po.teacher_cents) FILTER (
             WHERE po.status = 'released'
               AND po.released_at >= date_trunc('month', ${at}::timestamptz AT TIME ZONE t.timezone) AT TIME ZONE t.timezone
           ), 0) AS released_month_cents,
           coalesce(sum(po.teacher_cents) FILTER (WHERE po.status = 'released'), 0) AS released_total_cents
      FROM teachers t
      LEFT JOIN payouts po ON po.teacher_id = t.id
     WHERE t.id = ${teacherId}
     GROUP BY t.id`.execute(db);

  const { rows } = await sql<{
    booking_id: string; starts_at: string; subject: string; first_name: string; gross_cents: number;
    commission_bps: number; teacher_cents: number; status: PayoutStatus; release_after: string; released_at: string | null;
  }>`
    SELECT po.booking_id, b.starts_at, sv.subject, st.first_name, po.gross_cents, po.commission_bps,
           po.teacher_cents, po.status, po.release_after, po.released_at
      FROM payouts po
      JOIN bookings b ON b.id = po.booking_id
      JOIN services sv ON sv.id = b.service_id
      JOIN students st ON st.id = b.student_id
     WHERE po.teacher_id = ${teacherId}
     ORDER BY b.starts_at DESC
     LIMIT ${ITEMS}`.execute(db);

  return {
    pendingCents: Number(sum?.pending_cents ?? 0),
    pendingCount: Number(sum?.pending_count ?? 0),
    releasedMonthCents: Number(sum?.released_month_cents ?? 0),
    releasedTotalCents: Number(sum?.released_total_cents ?? 0),
    items: rows.map((r) => ({
      bookingId: r.booking_id,
      startsAt: instantFromDb(r.starts_at),
      subject: subjectName(r.subject),
      studentFirstName: r.first_name,
      grossCents: r.gross_cents,
      commissionBps: r.commission_bps,
      teacherCents: r.teacher_cents,
      status: r.status,
      releaseAfter: instantFromDb(r.release_after),
      releasedAt: r.released_at ? instantFromDb(r.released_at) : null,
    })),
  };
}
