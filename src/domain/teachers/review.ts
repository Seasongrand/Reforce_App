/**
 * Envio do cadastro para a análise da equipe (§1, professor, passo 3): exige
 * perfil completo, os documentos enviados (a certidão só para aula presencial)
 * e a conta de recebimento.
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { Deps } from '../deps';
import { DomainError } from '../errors';
import { DEFAULT_SLUG_PREFIX } from './profile';
import { KIND_LABEL, requiredKinds } from './verification';

export async function missingForReview(deps: Deps, teacherId: string, now: Temporal.Instant): Promise<string[]> {
  const t = await deps.db.selectFrom('teachers').select(['slug', 'display_name']).where('id', '=', teacherId)
    .executeTakeFirstOrThrow();
  const subjects = await sql<{ n: number }>`SELECT count(*)::int AS n FROM teacher_subjects WHERE teacher_id = ${teacherId}`
    .execute(deps.db);
  const today = now.toZonedDateTimeISO('America/Sao_Paulo').toPlainDate().toString();
  const live = await deps.db.selectFrom('teacher_verifications').select(['kind', 'status', 'valid_until'])
    .where('teacher_id', '=', teacherId).where('status', 'in', ['pending', 'approved']).execute();
  const acc = await deps.db.selectFrom('teacher_payment_accounts').select('status').where('teacher_id', '=', teacherId)
    .where('status', 'in', ['pending', 'active']).executeTakeFirst();
  const missing: string[] = [];
  if (t.slug.startsWith(DEFAULT_SLUG_PREFIX) || subjects.rows[0]!.n === 0) {
    missing.push('perfil (nome, endereço da página e disciplinas)');
  }
  for (const kind of await requiredKinds(deps, teacherId)) {
    const ok = live.some((v) => v.kind === kind && (v.status === 'pending' || !v.valid_until || v.valid_until >= today));
    if (!ok) missing.push(`documento de ${KIND_LABEL[kind]}`);
  }
  if (!acc) missing.push('conta de recebimento');
  return missing;
}

export async function submitForReview(deps: Deps, teacherId: string, now: Temporal.Instant): Promise<void> {
  const t = await deps.db.selectFrom('teachers').select('status').where('id', '=', teacherId).executeTakeFirstOrThrow();
  if (t.status === 'in_review') throw new DomainError('conflict', 'o cadastro já está em análise');
  if (t.status !== 'draft') throw new DomainError('conflict', 'o cadastro já foi analisado');
  const missing = await missingForReview(deps, teacherId, now);
  if (missing.length > 0) throw new DomainError('invalid', `Falta: ${missing.join(', ')}`);
  await sql`UPDATE teachers SET status = 'in_review' WHERE id = ${teacherId} AND status = 'draft'`.execute(deps.db);
}
