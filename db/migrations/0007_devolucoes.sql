-- Quanto de cada cobrança já foi devolvido. A tarefa de devolução recebe o
-- total que deve estar devolvido (não "devolva mais X"), então repeti-la não
-- devolve em dobro.
ALTER TABLE payments
  ADD COLUMN refunded_cents int NOT NULL DEFAULT 0
      CHECK (refunded_cents >= 0 AND refunded_cents <= amount_cents);
