-- Retrato do próximo horário (apêndice, bloco "Retrato do próximo horário") e índice de busca.

-- Refaz o retrato do próximo horário livre de um professor, por modalidade.
-- Usa o serviço mais curto de cada modalidade como referência para o cartão da busca.
-- Desvio aprovado em 16/11/2026: o apêndice começa em p_now::date, que depende do fuso da
-- sessão; em UTC, às 22h de São Paulo já é o dia seguinte e a noite local some do retrato.
-- Começar um dia antes não muda o resultado, porque free_slots filtra por instante.
CREATE OR REPLACE FUNCTION refresh_next_slot(p_teacher uuid, p_now timestamptz)
RETURNS void LANGUAGE sql AS $$
INSERT INTO teacher_next_slot (teacher_id, modality, min_price_cents, next_slot_at, slots_7d, refreshed_at)
SELECT p_teacher, m.modality, m.min_price,
       (SELECT min(s) FROM free_slots(p_teacher, m.ref_service,
                                      p_now::date - 1, (p_now + interval '30 days')::date, p_now) s),
       (SELECT count(*) FROM free_slots(p_teacher, m.ref_service,
                                        p_now::date - 1, (p_now + interval '7 days')::date, p_now) s
         WHERE s < p_now + interval '7 days'),
       p_now
  FROM (SELECT modality,
               min(price_cents) AS min_price,
               (array_agg(id ORDER BY duration_min, price_cents))[1] AS ref_service
          FROM services
         WHERE teacher_id = p_teacher AND active
         GROUP BY modality) m
ON CONFLICT (teacher_id, modality) DO UPDATE
   SET min_price_cents = EXCLUDED.min_price_cents,
       next_slot_at    = EXCLUDED.next_slot_at,
       slots_7d        = EXCLUDED.slots_7d,
       refreshed_at    = EXCLUDED.refreshed_at;
$$;

-- Índice de busca (§2.5): uma linha por professor, refeita quando o perfil,
-- as disciplinas ou as avaliações mudam. unaccent não pode ir em índice de
-- expressão (não é imutável), por isso o texto fica em coluna própria.
CREATE OR REPLACE FUNCTION refresh_teacher_search(p_teacher uuid)
RETURNS void LANGUAGE sql AS $$
INSERT INTO teacher_search (teacher_id, doc, subject_ids, grade_ids, rating_sum, rating_count,
                            lat, lng, travel_radius_km, refreshed_at)
SELECT t.id,
       to_tsvector('portuguese', unaccent(concat_ws(' ', t.display_name, t.headline, t.bio,
         (SELECT string_agg(DISTINCT s.name, ' ')
            FROM teacher_subjects x JOIN subjects s ON s.id = x.subject_id
           WHERE x.teacher_id = t.id)))),
       coalesce((SELECT array_agg(DISTINCT x.subject_id ORDER BY x.subject_id)
                   FROM teacher_subjects x WHERE x.teacher_id = t.id), '{}'),
       coalesce((SELECT array_agg(DISTINCT x.grade_level_id ORDER BY x.grade_level_id)
                   FROM teacher_subjects x WHERE x.teacher_id = t.id), '{}'),
       coalesce((SELECT sum(r.rating)::int FROM reviews r
                  WHERE r.teacher_id = t.id AND r.status = 'published'), 0),
       (SELECT count(*)::int FROM reviews r WHERE r.teacher_id = t.id AND r.status = 'published'),
       t.base_lat, t.base_lng, t.travel_radius_km, now()
  FROM teachers t
 WHERE t.id = p_teacher
ON CONFLICT (teacher_id) DO UPDATE
   SET doc              = EXCLUDED.doc,
       subject_ids      = EXCLUDED.subject_ids,
       grade_ids        = EXCLUDED.grade_ids,
       rating_sum       = EXCLUDED.rating_sum,
       rating_count     = EXCLUDED.rating_count,
       lat              = EXCLUDED.lat,
       lng              = EXCLUDED.lng,
       travel_radius_km = EXCLUDED.travel_radius_km,
       refreshed_at     = EXCLUDED.refreshed_at;
$$;
