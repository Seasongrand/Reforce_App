-- Certidão de antecedentes só para aula presencial (decisão do dono, 22/11).
-- Quem dá só aula online vende com identidade e formação. O serviço presencial
-- só tem horário livre (e portanto só aparece e só vende) com a certidão
-- aprovada e dentro da validade.

CREATE FUNCTION in_person_cleared(p_teacher uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM teacher_verifications v
                  WHERE v.teacher_id = p_teacher AND v.kind = 'criminal_record' AND v.status = 'approved'
                    AND (v.valid_until IS NULL OR v.valid_until >= current_date));
$$;

-- aprovado, com identidade e formação em dia (a certidão vale só para o presencial)
CREATE OR REPLACE VIEW teachers_listed AS
SELECT t.id
  FROM teachers t
 WHERE t.status = 'approved'
   AND (SELECT count(DISTINCT v.kind)
          FROM teacher_verifications v
         WHERE v.teacher_id = t.id AND v.status = 'approved' AND v.kind IN ('identity','education')
           AND (v.valid_until IS NULL OR v.valid_until >= current_date)) = 2;

-- igual à 0003, com o filtro do serviço presencial no bloco svc
CREATE OR REPLACE FUNCTION free_slots(p_teacher uuid, p_service uuid,
                                      p_from date, p_to date, p_now timestamptz)
RETURNS SETOF timestamptz
LANGUAGE sql STABLE AS $$
WITH t AS (
  SELECT id, timezone, min_notice_min, horizon_days, slot_step_min
  FROM teachers WHERE id = p_teacher
), svc AS (
  SELECT duration_min, buffer_before_min, buffer_after_min
  FROM services WHERE id = p_service
   AND (modality = 'online' OR in_person_cleared(p_teacher))
), days AS (
  SELECT d::date AS day
  FROM generate_series(p_from, p_to, interval '1 day') d
), windows AS (              -- regra semanal (hora local) -> intervalo de instantes
  SELECT tstzrange((day + r.start_local) AT TIME ZONE t.timezone,
                   (day + r.end_local)   AT TIME ZONE t.timezone, '[)') AS w
  FROM t
  JOIN availability_rules r ON r.teacher_id = t.id
  JOIN days ON extract(isodow FROM day) = r.weekday
           AND (r.valid_from  IS NULL OR day >= r.valid_from)
           AND (r.valid_until IS NULL OR day <= r.valid_until)
  UNION
  SELECT tstzrange((o.on_date + o.start_local) AT TIME ZONE t.timezone,
                   (o.on_date + o.end_local)   AT TIME ZONE t.timezone, '[)')
  FROM t JOIN availability_overrides o
    ON o.teacher_id = t.id AND o.kind = 'extra'
   AND o.on_date BETWEEN p_from AND p_to
), busy AS (                 -- tudo que ocupa o professor, num unico multirange
  SELECT coalesce(range_agg(b), '{}'::tstzmultirange) AS mr FROM (
    SELECT bk.blocked AS b FROM bookings bk, t
     WHERE bk.teacher_id = t.id
       AND (bk.status = 'confirmed'
            OR (bk.status = 'held' AND bk.hold_expires_at > p_now))
    UNION ALL
    SELECT e.during FROM external_busy e, t WHERE e.teacher_id = t.id
    UNION ALL
    SELECT tstzrange(
             (o.on_date + coalesce(o.start_local, time '00:00')) AT TIME ZONE t.timezone,
             CASE WHEN o.end_local IS NULL
                  THEN ((o.on_date + 1) + time '00:00') AT TIME ZONE t.timezone
                  ELSE (o.on_date + o.end_local) AT TIME ZONE t.timezone END, '[)')
    FROM t JOIN availability_overrides o ON o.teacher_id = t.id AND o.kind = 'block'
  ) x
)
SELECT s AS starts_at
FROM t, svc, busy, windows,
     LATERAL generate_series(lower(w),
                             upper(w) - make_interval(mins => svc.duration_min),
                             make_interval(mins => t.slot_step_min)) AS s
WHERE s >= p_now + make_interval(mins => t.min_notice_min)
  AND s <  p_now + make_interval(days => t.horizon_days)
  AND NOT busy.mr && tstzrange(s - make_interval(mins => svc.buffer_before_min),
                               s + make_interval(mins => svc.duration_min + svc.buffer_after_min), '[)')
ORDER BY s;
$$;
