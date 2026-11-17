-- Foto do professor (projeto "aluno: do perfil ao pagamento").
-- Guardada já processada (quadrado de 512 px, WEBP, sem metadados), cerca de
-- 50 KB por foto. A equipe confere com o documento de identidade antes de a
-- foto aparecer no perfil. No máximo uma em análise e uma aprovada por vez;
-- as anteriores ficam como 'replaced' (histórico).
CREATE TABLE teacher_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    uuid NOT NULL REFERENCES teachers(id),
  image         bytea NOT NULL,
  width         int  NOT NULL,
  height        int  NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'replaced')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  decided_at    timestamptz,
  decided_by    uuid REFERENCES staff_users(id),
  decision_note text
);

CREATE UNIQUE INDEX teacher_photos_one_pending ON teacher_photos (teacher_id) WHERE status = 'pending';
CREATE UNIQUE INDEX teacher_photos_one_approved ON teacher_photos (teacher_id) WHERE status = 'approved';
