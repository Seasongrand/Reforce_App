-- Conta do aluno (projeto 3 do lado do aluno): a conta é do adulto
-- responsável ("menores sem login" continua valendo), que entra com código
-- no e-mail, sem senha.
ALTER TABLE auth_codes DROP CONSTRAINT auth_codes_purpose_check;
ALTER TABLE auth_codes ADD CONSTRAINT auth_codes_purpose_check
  CHECK (purpose IN ('teacher_login', 'staff_login', 'guardian_checkout', 'guardian_login'));
