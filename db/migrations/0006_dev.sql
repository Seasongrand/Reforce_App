-- Tabelas dos adaptadores falsos e das ferramentas de desenvolvimento (/dev).
-- Ficam vazias em produção: a aplicação recusa DEV_TOOLS=1 e adaptadores
-- falsos com NODE_ENV=production.

-- Deslocamento do relógio de desenvolvimento (simular a passagem do tempo).
CREATE TABLE dev_clock (
  id        boolean PRIMARY KEY DEFAULT true CHECK (id),
  offset_ms bigint NOT NULL DEFAULT 0
);

-- Mensagens "enviadas" pelos adaptadores falsos de WhatsApp e e-mail.
CREATE TABLE dev_outbox (
  id         bigserial PRIMARY KEY,
  channel    text NOT NULL CHECK (channel IN ('whatsapp','email')),
  recipient  text NOT NULL,
  template   text,
  subject    text,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Chamadas recebidas pelos provedores falsos (pagamento, vídeo, calendário).
CREATE TABLE dev_provider_calls (
  id         bigserial PRIMARY KEY,
  provider   text NOT NULL,
  operation  text NOT NULL,
  ref        text NOT NULL,
  payload    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dev_provider_calls_ref ON dev_provider_calls (ref, operation);

-- Compromissos simulados do calendário externo do professor.
CREATE TABLE dev_calendar_busy (
  id         bigserial PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES teachers(id),
  during     tstzrange NOT NULL
);
