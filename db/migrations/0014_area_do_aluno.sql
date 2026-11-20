-- Área do aluno: cadastro do responsável sem compra e troca de e-mail em
-- "Meus dados", os dois confirmados por código no e-mail.
ALTER TABLE auth_codes DROP CONSTRAINT auth_codes_purpose_check;
ALTER TABLE auth_codes ADD CONSTRAINT auth_codes_purpose_check
  CHECK (purpose IN ('teacher_login', 'staff_login', 'guardian_checkout', 'guardian_login',
                     'guardian_signup', 'guardian_email_change'));
