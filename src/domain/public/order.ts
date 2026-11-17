/** Pedido visto pela família que o fez (página de pagamento e de confirmação). */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { CheckoutData } from '@/providers/payment/types';
import { instantFromDb } from '@/time/zoned';
import { subjectName } from '../catalog';
import type { Deps } from '../deps';
import { approvedPhotoId } from '../teachers/photo';

export interface OrderView {
  orderId: string;
  status: string;
  bookingId: string;
  bookingStatus: string;
  teacherName: string;
  teacherSlug: string;
  /** Foto aprovada do professor (/api/fotos/<id>), ou null: a tela mostra as iniciais. */
  teacherPhotoUrl: string | null;
  studentFirstName: string;
  teacherTimezone: string;
  guardianTimezone: string;
  subject: string;
  modality: 'online' | 'at_teacher' | 'at_student';
  startsAt: string;
  durationMin: number;
  totalCents: number;
  holdExpiresAt: string | null;
  payment: null | { method: 'pix' | 'card'; status: string; pixPayload: string | null; cardUrl: string | null; expiresAt: string | null };
}

export async function orderView(deps: Deps, orderId: string, guardianId: string, _now: Temporal.Instant): Promise<OrderView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const { rows } = await sql<{
    status: string; booking_id: string; booking_status: string; t_name: string; t_slug: string; t_tz: string; g_tz: string | null;
    subject: string; modality: string; starts_at: string; duration_min: number; total_cents: number; lessons: number;
    hold_expires_at: string | null; teacher_id: string; student_first_name: string;
  }>`
    SELECT o.status, b.id AS booking_id, b.status AS booking_status, t.display_name AS t_name, t.slug AS t_slug,
           t.timezone AS t_tz, g.timezone AS g_tz, sv.subject, b.modality, b.starts_at, sv.duration_min,
           o.total_cents, o.lessons, b.hold_expires_at, t.id AS teacher_id, st.first_name AS student_first_name
      FROM orders o
      JOIN bookings b ON b.order_id = o.id
      JOIN teachers t ON t.id = o.teacher_id
      JOIN guardians g ON g.id = o.guardian_id
      JOIN services sv ON sv.id = o.service_id
      JOIN students st ON st.id = b.student_id
     WHERE o.id = ${orderId} AND o.guardian_id = ${guardianId}
     ORDER BY b.starts_at LIMIT 1`.execute(deps.db);
  const r = rows[0];
  if (!r) return null;
  const p = await deps.db.selectFrom('payments').select(['method', 'status', 'checkout_data', 'expires_at'])
    .where('order_id', '=', orderId).where('status', 'in', ['pending', 'paid', 'refunded'])
    .orderBy('created_at', 'desc').executeTakeFirst();
  const checkout = (p?.checkout_data ?? null) as CheckoutData | null;
  return {
    orderId,
    status: r.status,
    bookingId: r.booking_id,
    bookingStatus: r.booking_status,
    teacherName: r.t_name,
    teacherSlug: r.t_slug,
    teacherPhotoUrl: await approvedPhotoId(deps, r.teacher_id).then((id) => (id ? `/api/fotos/${id}` : null)),
    studentFirstName: r.student_first_name,
    teacherTimezone: r.t_tz,
    guardianTimezone: r.g_tz ?? r.t_tz,
    subject: subjectName(r.subject),
    modality: r.modality as OrderView['modality'],
    startsAt: instantFromDb(r.starts_at).toString(),
    durationMin: r.duration_min,
    totalCents: Math.round(r.total_cents / r.lessons),
    holdExpiresAt: r.hold_expires_at ? instantFromDb(r.hold_expires_at).toString() : null,
    payment: p
      ? {
          method: p.method as 'pix' | 'card',
          status: p.status,
          pixPayload: checkout?.pix?.qrPayload ?? null,
          cardUrl: checkout?.card?.checkoutUrl ?? null,
          expiresAt: p.expires_at ? instantFromDb(p.expires_at).toString() : null,
        }
      : null,
  };
}
