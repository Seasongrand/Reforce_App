/**
 * Busca com texto livre e distância (apêndice, §2.5). A tela de busca é da
 * Fase 2; a consulta já fica aqui, testada, para não mudar de lugar depois.
 */
export type SearchModality = 'online' | 'at_teacher' | 'at_student';

export interface SearchParams {
  subject: number;
  grade: number;
  modality: SearchModality;
  maxPriceCents: number;
  /** Ponto da família (obrigatório fora do online). */
  lat?: number | null;
  lng?: number | null;
  /** Raio que a família aceita andar até o professor (aula no endereço dele). */
  familyRadiusKm?: number | null;
  /** Texto livre; vazio desliga o filtro. */
  q: string;
  /** Instante de referência, ISO ou literal timestamptz. */
  now: string;
}

export function searchParams(p: SearchParams): unknown[] {
  return [
    p.subject,
    p.grade,
    p.modality,
    p.maxPriceCents,
    p.lat ?? null,
    p.lng ?? null,
    p.familyRadiusKm ?? null,
    p.q,
    p.now,
  ];
}

export const SEARCH_SQL = `
SELECT t.id AS teacher_id,
       t.display_name,
       ns.min_price_cents,
       ns.next_slot_at,
       ns.slots_7d,
       -- média bayesiana: cada professor começa com 5 notas de 4,5
       round((ts.rating_sum + 4.5 * 5)::numeric / (ts.rating_count + 5), 2) AS nota,
       ts.rating_count AS avaliacoes,
       CASE WHEN $3::text = 'online' THEN NULL
            ELSE round((earth_distance(ll_to_earth(ts.lat, ts.lng),
                                       ll_to_earth($5::float8, $6::float8)) / 1000)::numeric, 1) END AS km
  FROM teacher_search ts
  JOIN teachers_listed l     ON l.id = ts.teacher_id          -- aprovado e com verificações em dia
  JOIN teachers t            ON t.id = ts.teacher_id
  JOIN teacher_next_slot ns  ON ns.teacher_id = ts.teacher_id AND ns.modality = $3::text
 WHERE ts.subject_ids @> ARRAY[$1::smallint]
   AND ts.grade_ids   @> ARRAY[$2::smallint]
   AND ns.min_price_cents <= $4::int
   AND ns.next_slot_at > $9::timestamptz                      -- sem horário livre, não aparece
   AND ($8::text = '' OR ts.doc @@ websearch_to_tsquery('portuguese', unaccent($8::text)))
   AND ($3::text = 'online'
        OR (earth_box(ll_to_earth($5::float8, $6::float8), 50000) @> ll_to_earth(ts.lat, ts.lng)   -- usa o índice
            AND earth_distance(ll_to_earth(ts.lat, ts.lng), ll_to_earth($5::float8, $6::float8))
                <= CASE WHEN $3::text = 'at_student' THEN ts.travel_radius_km * 1000  -- raio do professor
                        ELSE $7::float8 * 1000 END))                                  -- raio da família
 ORDER BY (ns.next_slot_at < $9::timestamptz + interval '7 days') DESC,   -- quem tem vaga na semana
          nota DESC,
          ns.next_slot_at`;
