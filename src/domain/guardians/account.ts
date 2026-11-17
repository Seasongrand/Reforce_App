/**
 * "Minha conta" do adulto responsável: próximas aulas (com o link da sala),
 * aulas anteriores (avaliar e marcar de novo) e os alunos cadastrados.
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import { instantFromDb } from '@/time/zoned';
import { gradeName, subjectName } from '../catalog';
import type { Deps } from '../deps';
import { lessonToken } from '../lessons/links';
import { REVIEW_WINDOW_DAYS } from '../reviews';

export interface AccountLesson {
  bookingId: string;
  orderId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  modality: 'online' | 'at_teacher' | 'at_student';
  subject: string;
  teacherName: string;
  teacherSlug: string;
  teacherPhotoUrl: string | null;
  studentFirstName: string;
  /** Página da aula (sala ou código), para as aulas confirmadas. */
  lessonUrl: string | null;
  review: { rating: number; comment: string | null } | null;
  canReview: boolean;
}

export interface AccountView {
  name: string;
  timezone: string;
  students: Array<{ firstName: string; grade: string }>;
  upcoming: AccountLesson[];
  past: AccountLesson[];
}

export async function accountView(deps: Deps, guardianId: string, now: Temporal.Instant): Promise<AccountView> {
  const g = await deps.db.selectFrom('guardians').select(['name', 'timezone']).where('id', '=', guardianId).executeTakeFirstOrThrow();
  const students = await deps.db.selectFrom('students').select(['first_name', 'grade'])
    .where('guardian_id', '=', guardianId).orderBy('first_name').execute();
  const { rows } = await sql<{
    booking_id: string; order_id: string; starts_at: string; ends_at: string; status: string; modality: string;
    subject: string; t_name: string; t_slug: string; photo_id: string | null; s_name: string;
    r_rating: number | null; r_comment: string | null;
  }>`
    SELECT b.id AS booking_id, b.order_id, b.starts_at, b.ends_at, b.status, b.modality, sv.subject,
           t.display_name AS t_name, t.slug AS t_slug, st.first_name AS s_name,
           (SELECT p.id FROM teacher_photos p WHERE p.teacher_id = t.id AND p.status = 'approved') AS photo_id,
           r.rating AS r_rating, r.comment AS r_comment
      FROM bookings b
      JOIN orders o ON o.id = b.order_id
      JOIN services sv ON sv.id = b.service_id
      JOIN teachers t ON t.id = b.teacher_id
      JOIN students st ON st.id = b.student_id
      LEFT JOIN reviews r ON r.booking_id = b.id
     WHERE o.guardian_id = ${guardianId}
       AND b.status IN ('confirmed', 'completed', 'no_show')
     ORDER BY b.starts_at`.execute(deps.db);
  const cutoff = now.subtract({ hours: 24 * REVIEW_WINDOW_DAYS });
  const lessons = rows.map((r): AccountLesson => {
    const endsAt = instantFromDb(r.ends_at);
    return {
      bookingId: r.booking_id,
      orderId: r.order_id,
      startsAt: instantFromDb(r.starts_at).toString(),
      endsAt: endsAt.toString(),
      status: r.status,
      modality: r.modality as AccountLesson['modality'],
      subject: subjectName(r.subject),
      teacherName: r.t_name,
      teacherSlug: r.t_slug,
      teacherPhotoUrl: r.photo_id ? `/api/fotos/${r.photo_id}` : null,
      studentFirstName: r.s_name,
      lessonUrl: r.status === 'confirmed'
        ? `/aula/${lessonToken(r.booking_id, 'student', endsAt.add({ hours: 24 }), deps.config.sessionSecret)}`
        : null,
      review: r.r_rating !== null ? { rating: r.r_rating, comment: r.r_comment } : null,
      canReview: r.status === 'completed' && r.r_rating === null && endsAt.epochMilliseconds > cutoff.epochMilliseconds,
    };
  });
  const isUpcoming = (l: AccountLesson) => l.status === 'confirmed' && Date.parse(l.endsAt) > now.epochMilliseconds;
  return {
    name: g.name,
    timezone: g.timezone ?? 'America/Sao_Paulo',
    students: students.map((s) => ({ firstName: s.first_name, grade: gradeName(s.grade) })),
    upcoming: lessons.filter(isUpcoming),
    past: lessons.filter((l) => !isUpcoming(l)).reverse(),
  };
}
