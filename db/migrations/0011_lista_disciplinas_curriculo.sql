-- Lista de espera: mestrado e doutorado na formação, e currículo opcional.
-- O currículo fica no banco (o disco do servidor não é permanente), um por
-- inscrição; reenviar troca o anterior. Só a equipe baixa, com a senha da
-- planilha.
ALTER TABLE teacher_waitlist DROP CONSTRAINT teacher_waitlist_education_check;
ALTER TABLE teacher_waitlist ADD CONSTRAINT teacher_waitlist_education_check
  CHECK (education IN ('licenciatura','graduacao','pos_graduacao','mestrado','doutorado','cursando','outro'));

CREATE TABLE teacher_waitlist_cvs (
  waitlist_id  uuid PRIMARY KEY REFERENCES teacher_waitlist(id) ON DELETE CASCADE,
  file_name    text NOT NULL,
  content_type text NOT NULL,
  bytes        bytea NOT NULL,
  uploaded_at  timestamptz NOT NULL
);
