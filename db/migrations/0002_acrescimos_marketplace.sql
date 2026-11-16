-- Apêndice "SQL testado" de docs/produto-e-arquitetura.md, bloco "Acréscimos do marketplace".
-- Copiado literalmente. Não editar: mudanças entram em migrações novas.

CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- catálogo fechado: a busca filtra por código, não por texto digitado
CREATE TABLE subjects (
  id   smallint PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL
);
CREATE TABLE grade_levels (
  id    smallint PRIMARY KEY,
  slug  text NOT NULL UNIQUE,
  name  text NOT NULL,
  stage text NOT NULL CHECK (stage IN ('fund2','medio','pre_vestibular'))
);

-- situação do professor na vitrine e área de atendimento presencial
ALTER TABLE teachers
  ADD COLUMN status text NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft','in_review','approved','paused','suspended')),
  ADD COLUMN headline text,
  ADD COLUMN bio text,
  ADD COLUMN base_lat double precision,       -- centro do CEP, nunca o endereço exato
  ADD COLUMN base_lng double precision,
  ADD COLUMN travel_radius_km numeric(4,1),   -- até onde vai à casa do aluno
  ADD CHECK ((base_lat IS NULL) = (base_lng IS NULL));

CREATE TABLE teacher_subjects (               -- o que ensina: disciplina x série
  teacher_id     uuid     NOT NULL REFERENCES teachers(id),
  subject_id     smallint NOT NULL REFERENCES subjects(id),
  grade_level_id smallint NOT NULL REFERENCES grade_levels(id),
  PRIMARY KEY (teacher_id, subject_id, grade_level_id)
);
ALTER TABLE services ADD COLUMN subject_id smallint REFERENCES subjects(id);

CREATE TABLE teacher_verifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   uuid NOT NULL REFERENCES teachers(id),
  kind         text NOT NULL CHECK (kind IN ('identity','criminal_record','education')),
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','approved','rejected','expired')),
  evidence_key text,            -- caminho do arquivo em armazenamento privado
  decided_at   timestamptz,
  valid_until  date             -- a certidão de antecedentes vence
);
CREATE UNIQUE INDEX one_live_verification
  ON teacher_verifications (teacher_id, kind) WHERE status IN ('pending','approved');

-- só aparece na busca quem está aprovado e com as três verificações em dia
CREATE VIEW teachers_listed AS
SELECT t.id
  FROM teachers t
 WHERE t.status = 'approved'
   AND (SELECT count(DISTINCT v.kind)
          FROM teacher_verifications v
         WHERE v.teacher_id = t.id AND v.status = 'approved'
           AND (v.valid_until IS NULL OR v.valid_until >= current_date)) = 3;

-- de onde veio cada família: decide a comissão e vale o primeiro contato
CREATE TABLE teacher_guardian_links (
  teacher_id  uuid NOT NULL REFERENCES teachers(id),
  guardian_id uuid NOT NULL REFERENCES guardians(id),
  acquisition text NOT NULL CHECK (acquisition IN ('marketplace','teacher_link')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (teacher_id, guardian_id)
);

CREATE TABLE addresses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id uuid NOT NULL REFERENCES guardians(id),
  cep         text NOT NULL,
  street      text NOT NULL,
  number      text,
  district    text,
  city        text NOT NULL,
  state       char(2) NOT NULL,
  lat         double precision,
  lng         double precision
);

ALTER TABLE bookings
  ADD COLUMN modality   text NOT NULL DEFAULT 'online'
      CHECK (modality IN ('online','at_teacher','at_student')),
  ADD COLUMN address_id uuid REFERENCES addresses(id),
  ADD CHECK (modality <> 'at_student' OR address_id IS NOT NULL);

-- o que aconteceu na aula: presença pelo vídeo ou pelo código da aula presencial
CREATE TABLE lesson_sessions (
  booking_id        uuid PRIMARY KEY REFERENCES bookings(id),
  video_room        text,
  teacher_joined_at timestamptz,
  student_joined_at timestamptz,
  teacher_seconds   int NOT NULL DEFAULT 0,
  student_seconds   int NOT NULL DEFAULT 0,
  checkin_code_hash text,
  checked_in_at     timestamptz,
  outcome           text CHECK (outcome IN ('taught','student_no_show','teacher_no_show','interrupted')),
  closed_at         timestamptz
);

CREATE TABLE reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid NOT NULL UNIQUE REFERENCES bookings(id),   -- uma avaliação por aula
  teacher_id    uuid NOT NULL REFERENCES teachers(id),
  guardian_id   uuid NOT NULL REFERENCES guardians(id),
  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       text,
  teacher_reply text,
  status        text NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payouts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id         uuid NOT NULL UNIQUE REFERENCES bookings(id),  -- um repasse por aula
  teacher_id         uuid NOT NULL REFERENCES teachers(id),
  gross_cents        int  NOT NULL,
  commission_bps     int  NOT NULL,          -- taxa congelada na reserva (1500 = 15%)
  platform_cents     int  NOT NULL,
  teacher_cents      int  NOT NULL,
  status             text NOT NULL DEFAULT 'held'
                     CHECK (status IN ('held','releasing','released','refunded')),
  release_after      timestamptz NOT NULL,   -- fim da aula + janela de contestação
  provider_escrow_id text,
  released_at        timestamptz,
  CHECK (gross_cents = platform_cents + teacher_cents)
);
CREATE INDEX payouts_due ON payouts (release_after) WHERE status = 'held';

CREATE TABLE disputes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES bookings(id),
  opened_by   text NOT NULL CHECK (opened_by IN ('guardian','teacher','support')),
  reason      text NOT NULL,
  status      text NOT NULL DEFAULT 'open'
              CHECK (status IN ('open','for_teacher','for_guardian','shared')),
  opened_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE UNIQUE INDEX one_open_dispute ON disputes (booking_id) WHERE status = 'open';

-- índice de busca: uma linha por professor, refeita quando o perfil muda
CREATE TABLE teacher_search (
  teacher_id       uuid PRIMARY KEY REFERENCES teachers(id),
  doc              tsvector   NOT NULL,      -- nome, chamada, bio e disciplinas, sem acento
  subject_ids      smallint[] NOT NULL,
  grade_ids        smallint[] NOT NULL,
  rating_sum       int NOT NULL DEFAULT 0,
  rating_count     int NOT NULL DEFAULT 0,
  lat              double precision,
  lng              double precision,
  travel_radius_km numeric(4,1),
  refreshed_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX teacher_search_doc  ON teacher_search USING gin (doc);
CREATE INDEX teacher_search_what ON teacher_search USING gin (subject_ids, grade_ids);
CREATE INDEX teacher_search_geo  ON teacher_search USING gist (ll_to_earth(lat, lng));

-- retrato do próximo horário livre, por modalidade; a reserva nunca confia nele
CREATE TABLE teacher_next_slot (
  teacher_id      uuid NOT NULL REFERENCES teachers(id),
  modality        text NOT NULL CHECK (modality IN ('online','at_teacher','at_student')),
  min_price_cents int  NOT NULL,
  next_slot_at    timestamptz,
  slots_7d        int  NOT NULL DEFAULT 0,
  refreshed_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (teacher_id, modality)
);

-- conversa entre responsável e professor; sempre dentro da plataforma
CREATE TABLE messages (
  id          bigserial PRIMARY KEY,
  teacher_id  uuid NOT NULL,
  guardian_id uuid NOT NULL,
  sender      text NOT NULL CHECK (sender IN ('teacher','guardian','system')),
  body        text NOT NULL,
  masked      boolean NOT NULL DEFAULT false,   -- telefone ou e-mail ocultado antes da primeira aula paga
  created_at  timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (teacher_id, guardian_id) REFERENCES teacher_guardian_links
);
CREATE INDEX messages_thread ON messages (teacher_id, guardian_id, created_at);
