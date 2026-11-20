-- Mensagens: até quando cada lado leu a conversa e quando foi avisado por
-- e-mail pela última vez (no máximo um aviso a cada 15 minutos).
ALTER TABLE teacher_guardian_links
  ADD COLUMN teacher_read_at      timestamptz,
  ADD COLUMN guardian_read_at     timestamptz,
  ADD COLUMN teacher_notified_at  timestamptz,
  ADD COLUMN guardian_notified_at timestamptz;
