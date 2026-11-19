/**
 * Atalhos da equipe (botões em /equipe): contas de teste para entrar no painel
 * interno, na área do professor e na da família sem código por e-mail.
 * Criadas na primeira vez e reaproveitadas depois, sem duplicar.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ensureTeamStaff, ensureTestGuardian, ensureTestTeacher, TEST_GUARDIAN_EMAIL, TEST_GUARDIAN_PHONE, TEST_TEACHER_EMAIL,
} from '@/domain/team-shortcuts';
import { closeAppDb } from '../helpers/app';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { testDeps } from '../helpers/scenario';

beforeEach(truncateAll);
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const q = async (text: string, params: unknown[] = []) => (await testPool().query(text, params)).rows;

describe('contas de atalho da equipe', () => {
  it('equipe: o e-mail de contato vira o cadastro da equipe, uma vez só', async () => {
    const deps = testDeps({ CONTACT_EMAIL: 'Ola.Reforce@Gmail.com' });
    const id = await ensureTeamStaff(deps);
    expect(await ensureTeamStaff(deps)).toBe(id);
    expect(await q(`SELECT id, email FROM staff_users`)).toEqual([{ id, email: 'ola.reforce@gmail.com' }]);
  });

  it('equipe: reaproveita o cadastro que a carga inicial já criou com o mesmo e-mail', async () => {
    const [seeded] = await q(`INSERT INTO staff_users (email, name) VALUES ('ola.reforce@gmail.com', 'Dono') RETURNING id`);
    expect(await ensureTeamStaff(testDeps())).toBe(seeded.id);
    expect(await q(`SELECT name FROM staff_users`)).toEqual([{ name: 'Dono' }]);
  });

  it('professor de teste: rascunho com e-mail .invalid; o que a equipe mudou depois fica', async () => {
    const id = await ensureTestTeacher(testDeps());
    expect(await q(`SELECT id, email, display_name, status FROM teachers`)).toEqual([
      { id, email: TEST_TEACHER_EMAIL, display_name: 'Professor de teste', status: 'draft' },
    ]);
    await q(`UPDATE teachers SET display_name = 'Ana Teste', status = 'in_review' WHERE id = $1`, [id]);
    expect(await ensureTestTeacher(testDeps())).toBe(id);
    expect(await q(`SELECT display_name, status FROM teachers`)).toEqual([{ display_name: 'Ana Teste', status: 'in_review' }]);
  });

  it('responsável de teste: telefone fictício e um aluno (primeiro nome e série), uma vez só', async () => {
    const id = await ensureTestGuardian(testDeps());
    expect(await ensureTestGuardian(testDeps())).toBe(id);
    expect(await q(`SELECT id, name, email, phone_e164 FROM guardians`)).toEqual([
      { id, name: 'Responsável de teste', email: TEST_GUARDIAN_EMAIL, phone_e164: TEST_GUARDIAN_PHONE },
    ]);
    expect(await q(`SELECT first_name, grade FROM students WHERE guardian_id = $1`, [id])).toEqual([
      { first_name: 'Aluno', grade: '9ano' },
    ]);
  });

  it('dois cliques ao mesmo tempo não duplicam o responsável nem o aluno', async () => {
    const ids = await Promise.all(Array.from({ length: 4 }, () => ensureTestGuardian(testDeps())));
    expect(new Set(ids).size).toBe(1);
    expect(await q(`SELECT count(*)::int AS n FROM students`)).toEqual([{ n: 1 }]);
  });
});
