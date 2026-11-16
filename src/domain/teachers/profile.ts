/**
 * Perfil do professor (§1, professor, passo 1): nome, endereço da página,
 * chamada, bio, fuso, disciplinas × séries do catálogo fechado, contato para
 * avisos e área de atendimento presencial (só o centro do CEP, §2.5).
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import { isUniqueViolation } from '@/db/errors';
import { onlyDigits } from '@/providers/geocoding/fake';
import { enqueue } from '@/worker/enqueue';
import type { Deps } from '../deps';
import { DomainError } from '../errors';
import { normalizePhoneBR } from '../guardians/identify';

export const BRAZIL_TIMEZONES = [
  'America/Sao_Paulo', 'America/Manaus', 'America/Noronha', 'America/Rio_Branco', 'America/Cuiaba',
  'America/Campo_Grande', 'America/Belem', 'America/Fortaleza', 'America/Recife', 'America/Bahia',
  'America/Porto_Velho', 'America/Boa_Vista',
] as const;

export interface ProfileInput {
  displayName: string;
  slug: string;
  headline?: string | null;
  bio?: string | null;
  timezone: string;
  phone?: string | null;
  whatsappOptIn: boolean;
  baseCep?: string | null;
  travelRadiusKm?: number | null;
  teachingAddress?: string | null;
  /** Pares [disciplina, série] do catálogo. */
  subjects: Array<[number, number]>;
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const DEFAULT_SLUG_PREFIX = 'professor-';

export async function updateTeacherProfile(deps: Deps, teacherId: string, input: ProfileInput, now: Temporal.Instant) {
  const displayName = input.displayName.trim();
  if (displayName.length < 3) throw new DomainError('invalid', 'informe seu nome como deve aparecer na página');
  const slug = input.slug.trim().toLowerCase();
  if (!SLUG_RE.test(slug) || slug.length < 3 || slug.length > 40) {
    throw new DomainError('invalid', 'endereço da página: use de 3 a 40 letras minúsculas, números e hífens');
  }
  if (!(BRAZIL_TIMEZONES as readonly string[]).includes(input.timezone)) throw new DomainError('invalid', 'fuso horário inválido');
  const headline = input.headline?.trim() || null;
  const bio = input.bio?.trim() || null;
  if (headline && headline.length > 120) throw new DomainError('invalid', 'a chamada deve ter até 120 caracteres');
  if (bio && bio.length > 2000) throw new DomainError('invalid', 'a apresentação deve ter até 2.000 caracteres');
  const phone = input.phone?.trim() ? normalizePhoneBR(input.phone) : null;
  const radius = input.travelRadiusKm ?? null;
  if (radius !== null && (!(radius > 0) || radius > 100)) throw new DomainError('invalid', 'raio de atendimento entre 0,1 e 100 km');
  const cep = input.baseCep?.trim() ? onlyDigits(input.baseCep) : null;
  if (cep !== null && cep.length !== 8) throw new DomainError('invalid', 'CEP inválido');
  const geo = cep ? await deps.providers.geocoder.cepToLatLng(cep) : null;

  const pairs = [...new Map(input.subjects.map(([s, g]) => [`${s}:${g}`, [s, g] as [number, number]])).values()];
  if (pairs.length === 0) throw new DomainError('invalid', 'escolha ao menos uma disciplina e série');
  const valid = await sql<{ n: number }>`
    SELECT count(*)::int AS n FROM unnest(${pairs.map((p) => p[0])}::smallint[], ${pairs.map((p) => p[1])}::smallint[]) AS x(s, g)
     WHERE EXISTS (SELECT 1 FROM subjects WHERE id = x.s) AND EXISTS (SELECT 1 FROM grade_levels WHERE id = x.g)`
    .execute(deps.db);
  if (valid.rows[0]!.n !== pairs.length) throw new DomainError('invalid', 'escolha disciplinas e séries do catálogo');

  try {
    await deps.db.transaction().execute(async (trx) => {
      await sql`UPDATE teachers SET
                  display_name = ${displayName}, slug = ${slug}, headline = ${headline}, bio = ${bio},
                  timezone = ${input.timezone}, phone_e164 = ${phone},
                  whatsapp_opt_in_at = CASE WHEN ${input.whatsappOptIn} AND ${phone}::text IS NOT NULL
                                            THEN coalesce(whatsapp_opt_in_at, ${now.toString()}::timestamptz) END,
                  base_cep = ${cep}, base_lat = ${geo?.lat ?? null}, base_lng = ${geo?.lng ?? null},
                  travel_radius_km = ${radius}, teaching_address = ${input.teachingAddress?.trim() || null}
                WHERE id = ${teacherId}`.execute(trx);
      await sql`DELETE FROM teacher_subjects WHERE teacher_id = ${teacherId}`.execute(trx);
      for (const [s, g] of pairs) {
        await sql`INSERT INTO teacher_subjects (teacher_id, subject_id, grade_level_id) VALUES (${teacherId}, ${s}, ${g})`
          .execute(trx);
      }
      await enqueue(trx, 'search.refresh_teacher', { teacherId }, { jobKey: `refresh:${teacherId}` });
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DomainError('conflict', 'este endereço de página já está em uso; escolha outro');
    throw err;
  }
}
