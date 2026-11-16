-- Apêndice "SQL testado" de docs/produto-e-arquitetura.md, bloco "Esquema".
-- Copiado literalmente. Não editar: mudanças entram em migrações novas.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE booking_status AS ENUM
  ('held','confirmed','completed','no_show','cancelled','rescheduled','expired');

CREATE TABLE teachers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE,
  display_name        text NOT NULL,
  timezone            text NOT NULL DEFAULT 'America/Sao_Paulo',
  min_notice_min      int  NOT NULL DEFAULT 120,
  horizon_days        int  NOT NULL DEFAULT 60,
  slot_step_min       int  NOT NULL DEFAULT 30,
  max_lessons_per_day int
);

CREATE TABLE services (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id        uuid NOT NULL REFERENCES teachers(id),
  subject           text NOT NULL,
  duration_min      int  NOT NULL CHECK (duration_min > 0),
  price_cents       int  NOT NULL CHECK (price_cents >= 0),
  modality          text NOT NULL CHECK (modality IN ('online','at_teacher','at_student')),
  buffer_before_min int  NOT NULL DEFAULT 0,
  buffer_after_min  int  NOT NULL DEFAULT 0,
  active            boolean NOT NULL DEFAULT true
);

CREATE TABLE availability_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES teachers(id),
  weekday     smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7), -- ISO: 1 = segunda
  start_local time NOT NULL,
  end_local   time NOT NULL,
  valid_from  date,
  valid_until date,
  CHECK (end_local > start_local)
);

CREATE TABLE availability_overrides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES teachers(id),
  on_date     date NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('block','extra')),
  start_local time,
  end_local   time
);

CREATE TABLE external_busy (
  id                bigserial PRIMARY KEY,
  teacher_id        uuid NOT NULL REFERENCES teachers(id),
  calendar_ref      text NOT NULL,
  provider_event_id text NOT NULL,
  during            tstzrange NOT NULL,
  UNIQUE (teacher_id, calendar_ref, provider_event_id)
);
CREATE INDEX external_busy_gist ON external_busy USING gist (teacher_id, during);

CREATE TABLE guardians (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  phone_e164         text NOT NULL UNIQUE,
  email              text,
  timezone           text,
  whatsapp_opt_in_at timestamptz
);

CREATE TABLE students (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id uuid NOT NULL REFERENCES guardians(id),
  first_name  text NOT NULL,
  grade       text
);

CREATE TABLE orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      uuid NOT NULL REFERENCES teachers(id),
  guardian_id     uuid NOT NULL REFERENCES guardians(id),
  student_id      uuid NOT NULL REFERENCES students(id),
  service_id      uuid NOT NULL REFERENCES services(id),
  lessons         int  NOT NULL DEFAULT 1,
  total_cents     int  NOT NULL,
  status          text NOT NULL DEFAULT 'awaiting_payment'
                  CHECK (status IN ('awaiting_payment','paid','expired','refunded','partially_refunded')),
  expires_at      timestamptz,
  idempotency_key text NOT NULL UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bookings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid NOT NULL REFERENCES orders(id),
  teacher_id       uuid NOT NULL REFERENCES teachers(id),
  student_id       uuid NOT NULL REFERENCES students(id),
  service_id       uuid NOT NULL REFERENCES services(id),
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  blocked          tstzrange   NOT NULL,   -- aula + intervalos; gravado pela aplicação
  local_start      timestamp   NOT NULL,   -- hora de parede combinada
  timezone         text        NOT NULL,   -- fuso IANA do professor na reserva
  status           booking_status NOT NULL DEFAULT 'held',
  hold_expires_at  timestamptz,
  rescheduled_from uuid REFERENCES bookings(id),
  external_event_id text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (blocked @> tstzrange(starts_at, ends_at, '[)')),
  CHECK (status <> 'held' OR hold_expires_at IS NOT NULL),
  CONSTRAINT no_double_booking EXCLUDE USING gist
    (teacher_id WITH =, blocked WITH &&)
    WHERE (status IN ('held','confirmed'))
);
CREATE INDEX bookings_teacher_start ON bookings (teacher_id, starts_at);

CREATE TABLE payments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           uuid NOT NULL REFERENCES orders(id),
  provider           text NOT NULL,
  provider_charge_id text NOT NULL,
  method             text NOT NULL CHECK (method IN ('pix','card')),
  amount_cents       int  NOT NULL,
  platform_fee_cents int  NOT NULL DEFAULT 0,
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','paid','expired','failed','refunded','disputed')),
  expires_at         timestamptz,
  paid_at            timestamptz,
  UNIQUE (provider, provider_charge_id)
);

CREATE TABLE webhook_events (
  id                bigserial PRIMARY KEY,
  provider          text NOT NULL,
  provider_event_id text NOT NULL,
  payload           jsonb NOT NULL,
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE notifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id          uuid NOT NULL REFERENCES bookings(id),
  channel             text NOT NULL CHECK (channel IN ('whatsapp','email')),
  template            text NOT NULL,
  send_at             timestamptz NOT NULL,
  status              text NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled','sent','delivered','failed','cancelled')),
  provider_message_id text,
  UNIQUE (booking_id, channel, template)
);
