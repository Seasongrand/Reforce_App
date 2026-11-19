/**
 * Perfil do professor (§1, professor, passo 1): nome, endereço da página,
 * chamada, bio, fuso, disciplinas × séries do catálogo fechado, contato para
 * avisos, área de atendimento presencial (só o centro do CEP, §2.5),
 * especialidades e o ano em que começou a dar aula (declarados pelo professor).
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import { isUniqueViolation } from '@/db/errors';
import { onlyDigits } from '@/providers/geocoding/fake';
import { enqueue } from '@/worker/enqueue';
import type { Deps } from '../deps';
import { DomainError } from '../errors';
import { experienceText } from '@/lib/teacher-experience';
import { normalizePhoneBR } from '../guardians/identify';

export const BRAZIL_TIMEZONES = [
  'America/Sao_Paulo', 'America/Manaus', 'America/Noronha', 'America/Rio_Branco', 'America/Cuiaba',
  'America/Campo_Grande', 'America/Belem', 'America/Fortaleza', 'America/Recife', 'America/Bahia',
  'America/Porto_Velho', 'America/Boa_Vista',
] as const;

/** Especialidades da página do professor, na ordem em que aparecem (lista fechada). */
export const TEACHER_SPECIALTIES = {
  reforco: 'Reforço escolar',
  tarefas: 'Ajuda com tarefas e trabalhos',
  provas: 'Preparação para provas',
  recuperacao: 'Recuperação',
  base: 'Recuperar a base',
  dificuldades: 'Dificuldades de aprendizagem',
  enem: 'ENEM',
  vestibular: 'Vestibulares',
  tecnicas_militares: 'Escolas técnicas e militares',
  olimpiadas: 'Olimpíadas do conhecimento',
} as const;
export type Specialty = keyof typeof TEACHER_SPECIALTIES;
export const MAX_SPECIALTIES = 6;
const SPECIALTY_KEYS = Object.keys(TEACHER_SPECIALTIES) as Specialty[];

const yearInSaoPaulo = (now: Temporal.Instant) => now.toZonedDateTimeISO('America/Sao_Paulo').year;

/** Ano corrente em São Paulo (a prévia do perfil recebe este valor do servidor). */
export const currentYearSaoPaulo = yearInSaoPaulo;

/** "13 anos de experiência" a partir do ano em que começou a dar aula; null quando não informado. */
export function experienceLabel(teachingSince: number | null, now: Temporal.Instant): string | null {
  return experienceText(teachingSince, yearInSaoPaulo(now));
}

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
  /** Até 6, da lista fechada. Ausente: não mexe no que está gravado. */
  specialties?: Specialty[];
  /** Ano em que começou a dar aula; null apaga. Ausente: não mexe no que está gravado. */
  teachingSince?: number | null;
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
  let specialties: Specialty[] | null = null;
  if (input.specialties !== undefined) {
    const chosen = new Set<string>(input.specialties);
    if ([...chosen].some((s) => !(s in TEACHER_SPECIALTIES))) throw new DomainError('invalid', 'especialidade fora da lista');
    if (chosen.size > MAX_SPECIALTIES) throw new DomainError('invalid', `escolha até ${MAX_SPECIALTIES} especialidades`);
    specialties = SPECIALTY_KEYS.filter((k) => chosen.has(k));
  }
  const since = input.teachingSince;
  if (since !== undefined && since !== null && (!Number.isInteger(since) || since < 1950 || since > yearInSaoPaulo(now))) {
    throw new DomainError('invalid', `ano em que começou a dar aula inválido: use de 1950 a ${yearInSaoPaulo(now)}`);
  }
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
                  travel_radius_km = ${radius}, teaching_address = ${input.teachingAddress?.trim() || null},
                  specialties = CASE WHEN ${specialties !== null} THEN ${specialties ?? []}::text[] ELSE specialties END,
                  teaching_since = CASE WHEN ${since !== undefined} THEN ${since ?? null}::smallint ELSE teaching_since END
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
