-- Perfil do professor: especialidades (até 6, de uma lista fechada, como as
-- "Experiências" das plataformas de terapia) e o ano em que começou a dar aula
-- (a página mostra "N anos de experiência"). Os dois são declarados pelo
-- professor, sem verificação da equipe.
ALTER TABLE teachers
  ADD COLUMN specialties text[] NOT NULL DEFAULT '{}'
      CHECK (cardinality(specialties) <= 6
             AND specialties <@ ARRAY['reforco','tarefas','provas','recuperacao','base','dificuldades',
                                      'enem','vestibular','tecnicas_militares','olimpiadas']),
  ADD COLUMN teaching_since smallint CHECK (teaching_since BETWEEN 1950 AND 2100);
