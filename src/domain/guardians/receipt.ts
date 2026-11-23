/**
 * Comprovante do pagamento de um pedido, para o responsável que pagou: quem
 * pagou, quanto, como e quando, as aulas e o que já foi devolvido. Não é nota
 * fiscal. Nunca traz contato nem endereço do professor (§3.7).
 */
import { sql } from 'kysely';
import type { Db } from '@/db/client';
import { instantFromDb } from '@/time/zoned';
import { subjectName } from '../catalog';

export interface OrderReceipt {
  orderId: string;
  /** Número curto para conferir com o suporte. */
  number: string;
  paidAt: string;
  method: 'pix' | 'card';
  amountCents: number;
  refundedCents: number;
  guardianName: string;
  teacherName: string;
  lessons: Array<{
    startsAt: string;
    subject: string;
    studentFirstName: string;
    modality: 'online' | 'at_teacher' | 'at_student';
    durationMin: number;
    status: string;
  }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function orderReceipt(db: Db, guardianId: string, orderId: string): Promise<OrderReceipt | null> {
  if (!UUID.test(orderId)) return null;
  const head = (await sql<{
    paid_at: string; method: 'pix' | 'card'; amount_cents: number; refunded_cents: number; g_name: string; t_name: string;
  }>`
    SELECT p.paid_at, p.method, p.amount_cents, p.refunded_cents, g.name AS g_name, t.display_name AS t_name
      FROM orders o
      JOIN guardians g ON g.id = o.guardian_id
      JOIN teachers t ON t.id = o.teacher_id
      JOIN payments p ON p.order_id = o.id AND p.status IN ('paid','refunded') AND p.paid_at IS NOT NULL
     WHERE o.id = ${orderId} AND o.guardian_id = ${guardianId}
     ORDER BY p.paid_at DESC LIMIT 1`.execute(db)).rows[0];
  if (!head) return null;
  const { rows } = await sql<{
    starts_at: string; subject: string; first_name: string; modality: OrderReceipt['lessons'][number]['modality'];
    duration_min: number; status: string;
  }>`
    SELECT b.starts_at, sv.subject, st.first_name, b.modality, sv.duration_min, b.status
      FROM bookings b
      JOIN services sv ON sv.id = b.service_id
      JOIN students st ON st.id = b.student_id
     WHERE b.order_id = ${orderId} AND b.status <> 'held'
     ORDER BY b.starts_at`.execute(db);
  return {
    orderId,
    number: orderId.slice(0, 8).toUpperCase(),
    paidAt: instantFromDb(head.paid_at).toString(),
    method: head.method,
    amountCents: head.amount_cents,
    refundedCents: head.refunded_cents,
    guardianName: head.g_name,
    teacherName: head.t_name,
    lessons: rows.map((r) => ({
      startsAt: instantFromDb(r.starts_at).toString(),
      subject: subjectName(r.subject),
      studentFirstName: r.first_name,
      modality: r.modality,
      durationMin: r.duration_min,
      status: r.status,
    })),
  };
}
