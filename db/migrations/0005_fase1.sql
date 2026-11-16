-- Acréscimos da Fase 1. Nada aqui altera a definição de bookings: a tabela
-- fica exatamente como no apêndice (só ganha um gatilho de auditoria).

-- Professor: login, aviso por WhatsApp e endereço para a aula "no endereço do
-- professor". O esquema do apêndice guarda só o centro do CEP (base_lat/lng);
-- o endereço completo só é mostrado à família depois do pagamento.
ALTER TABLE teachers
  ADD COLUMN email              text UNIQUE,
  ADD COLUMN phone_e164         text,
  ADD COLUMN whatsapp_opt_in_at timestamptz,
  ADD COLUMN base_cep           text,
  ADD COLUMN teaching_address   text,
  ADD COLUMN created_at         timestamptz NOT NULL DEFAULT now();

-- Comissão congelada na reserva (§2.2: preço e comissão congelam na compra).
ALTER TABLE orders
  ADD COLUMN commission_bps int NOT NULL CHECK (commission_bps BETWEEN 0 AND 10000);

-- Dados que o provedor devolve para pagar: QR e copia-e-cola do PIX ou link do cartão.
ALTER TABLE payments
  ADD COLUMN checkout_data jsonb,
  ADD COLUMN created_at    timestamptz NOT NULL DEFAULT now();
CREATE INDEX payments_order ON payments (order_id);

-- Quando a liberação foi tentada, para conciliar repasse parado em 'releasing'.
ALTER TABLE payouts
  ADD COLUMN release_attempted_at timestamptz;

-- Tentativas de digitar o código da aula presencial.
ALTER TABLE lesson_sessions
  ADD COLUMN checkin_attempts int NOT NULL DEFAULT 0;

-- Equipe interna (painel de análise).
CREATE TABLE staff_users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL UNIQUE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Decisão da equipe sobre cada verificação.
ALTER TABLE teacher_verifications
  ADD COLUMN decision_note text,
  ADD COLUMN decided_by    uuid REFERENCES staff_users(id),
  ADD COLUMN submitted_at  timestamptz NOT NULL DEFAULT now();

-- Conta de recebimento do professor no provedor (subconta). CPF e dados
-- bancários vão direto ao provedor; aqui ficam só os identificadores.
CREATE TABLE teacher_payment_accounts (
  teacher_id          uuid PRIMARY KEY REFERENCES teachers(id),
  provider            text NOT NULL,
  provider_account_id text NOT NULL,
  wallet_id           text NOT NULL,
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','rejected')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Calendário externo conectado (§2.2). O token fica cifrado.
CREATE TABLE calendar_connections (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id          uuid NOT NULL REFERENCES teachers(id),
  provider            text NOT NULL CHECK (provider IN ('google','microsoft','fake')),
  account_email       text,
  token_ciphertext    bytea,
  busy_calendar_ids   text[] NOT NULL DEFAULT '{}',
  lessons_calendar_id text,
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','error')),
  last_synced_at      timestamptz,
  last_error          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, provider)
);

-- Histórico de estados das aulas (§2.2), alimentado por gatilho para cobrir
-- também as varreduras. Quem mudou vem de set_config('app.actor', ..., true).
CREATE TABLE booking_events (
  id          bigserial PRIMARY KEY,
  booking_id  uuid NOT NULL REFERENCES bookings(id),
  from_status booking_status,
  to_status   booking_status NOT NULL,
  actor       text,
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX booking_events_booking ON booking_events (booking_id, id);

CREATE FUNCTION log_booking_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO booking_events (booking_id, from_status, to_status, actor)
  VALUES (NEW.id,
          CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END,
          NEW.status,
          nullif(current_setting('app.actor', true), ''));
  RETURN NULL;
END $$;

CREATE TRIGGER bookings_status_insert AFTER INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION log_booking_status();
CREATE TRIGGER bookings_status_update AFTER UPDATE OF status ON bookings
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_booking_status();

-- Login sem senha por código (professor, equipe e responsável no checkout).
-- payload guarda os dados ainda não confirmados da identificação.
CREATE TABLE auth_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose     text NOT NULL CHECK (purpose IN ('teacher_login','staff_login','guardian_checkout')),
  destination text NOT NULL,
  code_hash   text NOT NULL,
  payload     jsonb,
  expires_at  timestamptz NOT NULL,
  attempts    int NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_codes_destination ON auth_codes (destination, created_at);

-- Sessões: só o hash do token. Aluno não tem login.
CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash   text NOT NULL UNIQUE,
  subject_type text NOT NULL CHECK (subject_type IN ('teacher','guardian','staff')),
  subject_id   uuid NOT NULL,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
