-- Lista de avisos para alunos: enquanto a plataforma não abre, o botão
-- "Entrar" leva a uma página onde o adulto responsável (ou o aluno maior de
-- idade) deixa o e-mail para ser avisado da abertura. Uma inscrição por e-mail;
-- mostra a procura por cidade, disciplina e etapa.
CREATE TABLE student_waitlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  city        text NOT NULL,
  state       char(2) NOT NULL,
  subject_ids smallint[] NOT NULL CHECK (cardinality(subject_ids) > 0),
  stages      text[] NOT NULL
              CHECK (cardinality(stages) > 0 AND stages <@ ARRAY['fund2','medio','pre_vestibular']),
  consent_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
