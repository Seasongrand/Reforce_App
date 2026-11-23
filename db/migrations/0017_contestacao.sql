-- Contestação da aula pela família (22/11): em até 24 horas depois da aula, uma
-- por aula. O repasse fica retido enquanto estiver aberta (CLAIM_DUE_PAYOUTS_SQL)
-- e a equipe decide: a favor do professor (libera) ou da família (devolve).
ALTER TABLE disputes
  ADD COLUMN decision_note text,
  ADD COLUMN resolved_by   uuid REFERENCES staff_users(id);

CREATE UNIQUE INDEX one_guardian_dispute ON disputes (booking_id) WHERE opened_by = 'guardian';
