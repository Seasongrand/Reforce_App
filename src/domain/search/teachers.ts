/**
 * Vitrine (projeto "vitrine com busca"): a consulta da §2.5 (SEARCH_SQL),
 * paginada e com os dados do cartão. Nota só aparece quando o professor tem
 * avaliações de verdade; a média bayesiana da consulta não vira nota na tela.
 */
import { CompiledQuery, sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { SearchForm } from '@/lib/search-form';
import { instantFromDb } from '@/time/zoned';
import type { Deps } from '../deps';
import { SEARCH_SQL, searchParams } from './sql';

export const PAGE_SIZE = 12;
/** Na aula no endereço do professor, até onde quem procura aceita ir. */
const FAMILY_RADIUS_KM = 10;
const NO_PRICE_LIMIT = 100_000_000;

export interface SearchItem {
  teacherId: string;
  slug: string;
  name: string;
  headline: string | null;
  photoUrl: string | null;
  minPriceCents: number;
  /** Próximo horário livre (ISO). */
  nextSlot: string;
  slotsWeek: number;
  rating: number | null;
  reviews: number;
  km: number | null;
}

export type SearchResult = { ok: true; items: SearchItem[]; hasMore: boolean } | { ok: false; error: 'cep' };

export async function searchTeachers(
  deps: Deps,
  form: SearchForm & { subjectId: number; gradeId: number },
  now: Temporal.Instant,
): Promise<SearchResult> {
  let point: { lat: number; lng: number } | null = null;
  if (form.modality !== 'online') {
    point = form.cep.length === 8 ? await deps.providers.geocoder.cepToLatLng(form.cep) : null;
    if (!point) return { ok: false, error: 'cep' };
  }
  const params = searchParams({
    subject: form.subjectId,
    grade: form.gradeId,
    modality: form.modality,
    maxPriceCents: form.maxPriceCents ?? NO_PRICE_LIMIT,
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    familyRadiusKm: FAMILY_RADIUS_KM,
    q: form.q,
    now: now.toString(),
  });
  const offset = (form.page - 1) * PAGE_SIZE;
  const { rows } = await deps.db.executeQuery<{
    teacher_id: string; min_price_cents: number; next_slot_at: string; slots_7d: number;
    nota: string; avaliacoes: number; km: string | null;
  // desempate fixo: sem ele, professores empatados podem trocar de página entre uma consulta e outra
  }>(CompiledQuery.raw(`${SEARCH_SQL}, ts.teacher_id\n LIMIT ${PAGE_SIZE + 1} OFFSET ${offset}`, params));
  const page = rows.slice(0, PAGE_SIZE);
  if (page.length === 0) return { ok: true, items: [], hasMore: false };
  const extra = await sql<{ id: string; slug: string; display_name: string; headline: string | null; photo_id: string | null }>`
    SELECT t.id, t.slug, t.display_name, t.headline,
           (SELECT p.id FROM teacher_photos p WHERE p.teacher_id = t.id AND p.status = 'approved') AS photo_id
      FROM teachers t WHERE t.id = ANY(${page.map((r) => r.teacher_id)}::uuid[])`.execute(deps.db);
  const byId = new Map(extra.rows.map((r) => [r.id, r]));
  return {
    ok: true,
    hasMore: rows.length > PAGE_SIZE,
    items: page.map((r) => {
      const t = byId.get(r.teacher_id)!;
      return {
        teacherId: r.teacher_id,
        slug: t.slug,
        name: t.display_name,
        headline: t.headline,
        photoUrl: t.photo_id ? `/api/fotos/${t.photo_id}` : null,
        minPriceCents: r.min_price_cents,
        nextSlot: instantFromDb(r.next_slot_at).toString(),
        slotsWeek: r.slots_7d,
        rating: r.avaliacoes > 0 ? Number(r.nota) : null,
        reviews: r.avaliacoes,
        km: r.km === null ? null : Number(r.km),
      };
    }),
  };
}
