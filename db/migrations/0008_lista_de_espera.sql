-- Lista de espera de professores (§4, largada a frio): recrutar e verificar
-- de 30 a 50 professores antes de abrir a busca. Uma inscrição por e-mail.
CREATE TABLE teacher_waitlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       text NOT NULL UNIQUE,
  phone_e164  text,
  city        text NOT NULL,
  state       char(2) NOT NULL,
  subject_ids smallint[] NOT NULL CHECK (cardinality(subject_ids) > 0),
  stages      text[] NOT NULL
              CHECK (cardinality(stages) > 0 AND stages <@ ARRAY['fund2','medio','pre_vestibular']),
  modalities  text[] NOT NULL
              CHECK (cardinality(modalities) > 0 AND modalities <@ ARRAY['online','presencial']),
  education   text NOT NULL
              CHECK (education IN ('licenciatura','graduacao','pos_graduacao','cursando','outro')),
  notes       text,
  consent_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
