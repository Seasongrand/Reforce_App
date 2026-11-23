-- Horário fixo semanal (decisão do dono, 22/11): a família reserva o mesmo
-- horário toda semana e paga cada aula por PIX. A aula da semana seguinte fica
-- reservada (bookings 'held') até 24 horas antes; o PIX sai 5 dias antes. Sem
-- pagamento, só aquela semana é perdida; três seguidas encerram o horário fixo.
CREATE TABLE weekly_series (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id  uuid NOT NULL REFERENCES guardians(id),
  teacher_id   uuid NOT NULL REFERENCES teachers(id),
  student_id   uuid NOT NULL REFERENCES students(id),
  service_id   uuid NOT NULL REFERENCES services(id),
  address_id   uuid REFERENCES addresses(id),
  -- hora de parede da primeira aula; as seguintes somam semanas na hora local (§2.1)
  local_start  timestamp NOT NULL,
  timezone     text NOT NULL,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  ended_reason text CHECK (ended_reason IN ('by_family','unpaid')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  CHECK ((status = 'ended') = (ended_at IS NOT NULL))
);
CREATE INDEX weekly_series_active ON weekly_series (status) WHERE status = 'active';

ALTER TABLE bookings ADD COLUMN series_id uuid REFERENCES weekly_series(id);
CREATE INDEX bookings_series ON bookings (series_id, local_start) WHERE series_id IS NOT NULL;
-- uma aula da série por semana
CREATE UNIQUE INDEX one_booking_per_series_week ON bookings (series_id, local_start)
  WHERE series_id IS NOT NULL AND status IN ('held','confirmed','completed','no_show');
