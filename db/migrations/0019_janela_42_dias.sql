-- O Asaas retém a parte do professor (Conta Escrow) por no máximo 45 dias.
-- Para a retenção não vencer antes da aula e da janela de contestação, a
-- agenda abre no máximo 42 dias (6 semanas) à frente (26/11).
UPDATE teachers SET horizon_days = 42 WHERE horizon_days > 42;
ALTER TABLE teachers ALTER COLUMN horizon_days SET DEFAULT 42;
ALTER TABLE teachers ADD CONSTRAINT horizon_ate_42_dias CHECK (horizon_days BETWEEN 1 AND 42);
