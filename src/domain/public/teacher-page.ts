/**
 * Dados da página pública do professor (§1, família, passo 3): perfil, selo
 * das três verificações com validade, serviços por modalidade e horários
 * livres calculados ao vivo. Nunca inclui contato, endereço nem dados de
 * recebimento do professor.
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import { availableSlots } from '../availability';
import { subjectName } from '../catalog';
import type { Deps } from '../deps';
import { approvedPhotoId } from '../teachers/photo';
import { experienceLabel, TEACHER_SPECIALTIES, type Specialty } from '../teachers/profile';
import { publicReviews, type PublicReviews } from '../reviews';

export interface PublicService {
  id: string;
  subject: string;
  modality: 'online' | 'at_teacher' | 'at_student';
  durationMin: number;
  priceCents: number;
  /** Instantes ISO (UTC); a página agrupa no fuso de quem vê. */
  slots: string[];
}

export interface PublicTeacherPage {
  teacherId: string;
  slug: string;
  name: string;
  headline: string | null;
  bio: string | null;
  timezone: string;
  sellable: boolean;
  subjects: Array<{ subject: string; grades: string[] }>;
  badges: Array<{ kind: 'identity' | 'criminal_record' | 'education'; validUntil: string | null }>;
  services: PublicService[];
  /** Endereço da foto aprovada (/api/fotos/<id>), ou null: o perfil mostra as iniciais. */
  photoUrl: string | null;
  /** Selo "Perfil verificado": vendendo e com as três verificações em dia. */
  verified: boolean;
  minPriceCents: number | null;
  modalities: Array<PublicService['modality']>;
  /** O horário livre mais próximo entre todos os serviços (ISO), ou null. */
  nextSlot: string | null;
  /** Especialidades declaradas pelo professor (rótulos, na ordem da lista). */
  specialties: string[];
  /** "13 anos de experiência", ou null quando o professor não informou. */
  experience: string | null;
  /** Média real e quantidade, só quando há avaliações publicadas. */
  rating: PublicReviews['rating'];
  reviews: PublicReviews['reviews'];
}

/** Dias de horários livres no perfil público: o calendário mostra até dois meses. */
export const PUBLIC_DAYS = 62;

export async function publicTeacherPage(deps: Deps, slug: string, now: Temporal.Instant): Promise<PublicTeacherPage | null> {
  const t = await deps.db.selectFrom('teachers')
    .select(['id', 'slug', 'display_name', 'headline', 'bio', 'timezone', 'horizon_days', 'specialties', 'teaching_since'])
    .where('slug', '=', slug).where('status', '=', 'approved').executeTakeFirst();
  if (!t) return null;

  const sellable = (await sql<{ ok: boolean }>`
    SELECT EXISTS (SELECT 1 FROM teachers_listed WHERE id = ${t.id})
       AND EXISTS (SELECT 1 FROM teacher_payment_accounts WHERE teacher_id = ${t.id} AND status = 'active') AS ok`
    .execute(deps.db)).rows[0]!.ok;

  const subjectRows = await sql<{ subject: string; grade: string }>`
    SELECT s.name AS subject, g.name AS grade FROM teacher_subjects ts
      JOIN subjects s ON s.id = ts.subject_id JOIN grade_levels g ON g.id = ts.grade_level_id
     WHERE ts.teacher_id = ${t.id} ORDER BY s.id, g.id`.execute(deps.db);
  const subjects: PublicTeacherPage['subjects'] = [];
  for (const r of subjectRows.rows) {
    const last = subjects.at(-1);
    if (last?.subject === r.subject) last.grades.push(r.grade);
    else subjects.push({ subject: r.subject, grades: [r.grade] });
  }

  const today = now.toZonedDateTimeISO('America/Sao_Paulo').toPlainDate().toString();
  const badges = (await sql<{ kind: 'identity' | 'criminal_record' | 'education'; valid_until: string | null }>`
    SELECT DISTINCT ON (kind) kind, valid_until FROM teacher_verifications
     WHERE teacher_id = ${t.id} AND status = 'approved' AND (valid_until IS NULL OR valid_until >= ${today}::date)
     ORDER BY kind, valid_until DESC NULLS FIRST`.execute(deps.db)).rows
    .map((b) => ({ kind: b.kind, validUntil: b.valid_until }));

  // aula presencial só com a certidão de antecedentes em dia (decisão do dono, 22/11)
  const inPersonCleared = badges.some((b) => b.kind === 'criminal_record');
  const svcs = (await deps.db.selectFrom('services').select(['id', 'subject', 'modality', 'duration_min', 'price_cents'])
    .where('teacher_id', '=', t.id).where('active', '=', true).orderBy('modality').orderBy('duration_min').execute())
    .filter((s) => s.modality === 'online' || inPersonCleared);
  const days = Math.min(t.horizon_days, PUBLIC_DAYS);
  const services: PublicService[] = [];
  for (const s of svcs) {
    const slots = sellable ? await availableSlots(deps, { teacherId: t.id, serviceId: s.id, days }, now) : [];
    services.push({
      id: s.id,
      subject: subjectName(s.subject),
      modality: s.modality as PublicService['modality'],
      durationMin: s.duration_min,
      priceCents: s.price_cents,
      slots: slots.map((x) => x.toString()),
    });
  }
  const photoId = await approvedPhotoId(deps, t.id);
  const allSlots = services.flatMap((s) => s.slots).sort();
  const order: Array<PublicService['modality']> = ['online', 'at_student', 'at_teacher'];
  // online primeiro, depois na casa do aluno e no endereço do professor; dentro de cada um, a mais curta
  services.sort((a, b) => order.indexOf(a.modality) - order.indexOf(b.modality) || a.durationMin - b.durationMin);
  return {
    teacherId: t.id, slug: t.slug, name: t.display_name, headline: t.headline, bio: t.bio, timezone: t.timezone,
    sellable, subjects, badges, services,
    photoUrl: photoId ? `/api/fotos/${photoId}` : null,
    verified: sellable && badges.some((b) => b.kind === 'identity') && badges.some((b) => b.kind === 'education'),
    minPriceCents: services.length > 0 ? Math.min(...services.map((s) => s.priceCents)) : null,
    modalities: order.filter((m) => services.some((s) => s.modality === m)),
    nextSlot: allSlots[0] ?? null,
    specialties: (t.specialties as Specialty[]).map((s) => TEACHER_SPECIALTIES[s] ?? s),
    experience: experienceLabel(t.teaching_since, now),
    ...(await publicReviews(deps, t.id)),
  };
}
