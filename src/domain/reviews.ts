/**
 * Avaliação da aula (projeto conta do aluno): nota de 1 a 5 e comentário
 * opcional, uma por aula concluída, até 30 dias depois. No perfil, o autor
 * aparece como "Maria L." e o nome do aluno nunca aparece; telefone e e-mail
 * digitados no comentário são ocultados.
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import { instantFromDb } from '@/time/zoned';
import type { Deps } from './deps';
import { DomainError } from './errors';
import { enqueue } from '@/worker/enqueue';

export const REVIEW_WINDOW_DAYS = 30;
const MAX_COMMENT = 1000;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// telefone brasileiro: DDD opcional entre parênteses, 8 ou 9 dígitos com hífen/espaço opcionais
const PHONE = /(\+?55[\s-]?)?(\(?\d{2}\)?[\s-]?)?9?\d{4}[\s-]?\d{4}\b/g;

export function maskContacts(text: string): string {
  return text.replace(EMAIL, '[contato removido]').replace(PHONE, (m) => (m.replace(/\D/g, '').length >= 8 ? '[contato removido]' : m));
}

export async function submitReview(
  deps: Deps,
  input: { guardianId: string; bookingId: string; rating: number; comment: string },
  now: Temporal.Instant,
): Promise<void> {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new DomainError('invalid', 'escolha uma nota de 1 a 5');
  }
  const comment = input.comment.trim().slice(0, MAX_COMMENT) || null;
  const b = (await sql<{ id: string; teacher_id: string; status: string; ends_at: string }>`
    SELECT b.id, b.teacher_id, b.status, b.ends_at FROM bookings b JOIN orders o ON o.id = b.order_id
     WHERE b.id = ${input.bookingId} AND o.guardian_id = ${input.guardianId}`.execute(deps.db)).rows[0];
  if (!b) throw new DomainError('not_found', 'aula não encontrada');
  if (b.status !== 'completed') throw new DomainError('conflict', 'a avaliação abre depois da aula concluída');
  if (now.since(instantFromDb(b.ends_at)).total('hours') > 24 * REVIEW_WINDOW_DAYS) {
    throw new DomainError('conflict', `a avaliação fica aberta por ${REVIEW_WINDOW_DAYS} dias depois da aula`);
  }
  await deps.db.transaction().execute(async (trx) => {
    const r = await sql`
      INSERT INTO reviews (booking_id, teacher_id, guardian_id, rating, comment, created_at)
      VALUES (${b.id}, ${b.teacher_id}, ${input.guardianId}, ${input.rating}, ${comment}, ${now.toString()}::timestamptz)
      ON CONFLICT (booking_id) DO NOTHING`.execute(trx);
    if (Number(r.numAffectedRows ?? 0) === 0) throw new DomainError('conflict', 'esta aula já foi avaliada');
    await enqueue(trx, 'search.refresh_teacher', { teacherId: b.teacher_id }, { jobKey: `refresh:${b.teacher_id}` });
  });
}

export interface PublicReviews {
  rating: { average: number; count: number } | null;
  reviews: Array<{ rating: number; comment: string | null; author: string; date: string }>;
}

/** Avaliações publicadas do professor, as mais recentes primeiro. */
export async function publicReviews(deps: Pick<Deps, 'db'>, teacherId: string, limit = 10): Promise<PublicReviews> {
  const agg = (await sql<{ n: number; avg: string | null }>`
    SELECT count(*)::int AS n, avg(rating)::numeric(3,2)::text AS avg FROM reviews
     WHERE teacher_id = ${teacherId} AND status = 'published'`.execute(deps.db)).rows[0]!;
  if (agg.n === 0) return { rating: null, reviews: [] };
  const { rows } = await sql<{ rating: number; comment: string | null; name: string; created_at: string }>`
    SELECT r.rating, r.comment, g.name, r.created_at FROM reviews r JOIN guardians g ON g.id = r.guardian_id
     WHERE r.teacher_id = ${teacherId} AND r.status = 'published'
     ORDER BY r.created_at DESC LIMIT ${limit}`.execute(deps.db);
  return {
    rating: { average: Math.round(Number(agg.avg) * 10) / 10, count: agg.n },
    reviews: rows.map((r) => {
      const parts = r.name.trim().split(/\s+/);
      const author = parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]!.toUpperCase()}.` : parts[0]!;
      return {
        rating: r.rating,
        comment: r.comment ? maskContacts(r.comment) : null,
        author,
        date: instantFromDb(r.created_at).toZonedDateTimeISO('America/Sao_Paulo').toPlainDate().toString(),
      };
    }),
  };
}
