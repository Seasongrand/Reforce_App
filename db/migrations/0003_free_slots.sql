-- Horários livres (§2.3), embrulhando a consulta "Horários livres" do apêndice.
-- Parâmetros: professor, serviço, período em datas locais do professor e o
-- instante de referência ("agora"). Devolve instantes de início, em ordem.
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

-- Conciliação quando a base de fusos muda (§2.1): aulas ativas cujo instante
-- deixou de corresponder à hora combinada.
CREATE VIEW bookings_tz_drift AS
SELECT id FROM bookings
 WHERE status IN ('held','confirmed')
   AND starts_at <> (local_start AT TIME ZONE timezone);
