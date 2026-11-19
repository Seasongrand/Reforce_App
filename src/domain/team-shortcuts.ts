/**
 * Atalhos da equipe (botões em /equipe): o dono entra no painel interno, na
 * área do professor e na da família sem código por e-mail. As contas são
 * criadas na primeira vez e reaproveitadas depois, sem desfazer o que a
 * equipe mudou nelas. Os e-mails de teste usam o domínio reservado .invalid
 * (nunca recebem mensagem) e o telefone de teste tem DDD 00, que não existe.
 */
import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import type { Deps } from './deps';
import { normalizeEmail } from './auth/codes';

export const TEST_TEACHER_EMAIL = 'professor.teste@reforce.invalid';
export const TEST_GUARDIAN_EMAIL = 'responsavel.teste@reforce.invalid';
export const TEST_GUARDIAN_PHONE = '+5500000000000';

/** Cadastro da equipe com o e-mail de contato (CONTACT_EMAIL), que é do dono. */
export async function ensureTeamStaff(deps: Deps): Promise<string> {
  const r = await sql<{ id: string }>`
    INSERT INTO staff_users (email, name) VALUES (${normalizeEmail(deps.config.contactEmail)}, 'Equipe Reforce')
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
    RETURNING id`.execute(deps.db);
  return r.rows[0]!.id;
}

/** Professor de teste, em rascunho: não aparece na busca enquanto não for aprovado. */
export async function ensureTestTeacher(deps: Deps): Promise<string> {
  const r = await sql<{ id: string }>`
    INSERT INTO teachers (slug, display_name, email)
    VALUES (${`professor-teste-${randomUUID().slice(0, 8)}`}, 'Professor de teste', ${TEST_TEACHER_EMAIL})
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
    RETURNING id`.execute(deps.db);
  return r.rows[0]!.id;
}

/**
 * Responsável de teste com um aluno (só primeiro nome e série). O upsert
 * trava a linha do responsável até o fim da transação: dois cliques ao mesmo
 * tempo não criam dois alunos.
 */
export async function ensureTestGuardian(deps: Deps): Promise<string> {
  return deps.db.transaction().execute(async (trx) => {
    const g = await sql<{ id: string }>`
      INSERT INTO guardians (name, phone_e164, email, timezone)
      VALUES ('Responsável de teste', ${TEST_GUARDIAN_PHONE}, ${TEST_GUARDIAN_EMAIL}, 'America/Sao_Paulo')
      ON CONFLICT (phone_e164) DO UPDATE SET phone_e164 = EXCLUDED.phone_e164
      RETURNING id`.execute(trx);
    const id = g.rows[0]!.id;
    await sql`
      INSERT INTO students (guardian_id, first_name, grade)
      SELECT ${id}, 'Aluno', '9ano' WHERE NOT EXISTS (SELECT 1 FROM students WHERE guardian_id = ${id})`.execute(trx);
    return id;
  });
}
