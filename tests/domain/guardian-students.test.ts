/**
 * Alunos em Minha conta: o responsável cadastra, edita e remove os alunos
 * (só primeiro nome e série). Aluno com aula na conta não pode ser removido.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { addStudent, listStudents, removeStudent, updateStudent } from '@/domain/guardians/students';
import { appDb, closeAppDb } from '../helpers/app';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { insertFamilyOrder, insertGuardian, insertService, insertTeacher, seedTestCatalog } from '../helpers/fixtures';

beforeEach(async () => {
  await truncateAll();
  await seedTestCatalog(testPool());
});
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

describe('alunos do responsável', () => {
  it('cadastra só o primeiro nome e a série e lista por nome, com o nome da série', async () => {
    const g = await insertGuardian(testPool());
    await addStudent(appDb(), g, { firstName: ' Pedro Lima ', grade: '1serie' });
    await addStudent(appDb(), g, { firstName: 'Ana', grade: '9ano' });
    expect(await listStudents(appDb(), g)).toEqual([
      expect.objectContaining({ firstName: 'Ana', grade: '9ano', gradeName: '9º ano', hasLessons: false }),
      expect.objectContaining({ firstName: 'Pedro', grade: '1serie', gradeName: '1ª série do ensino médio', hasLessons: false }),
    ]);
  });

  it('recusa nome curto, série inválida e nome repetido (sem diferenciar maiúsculas)', async () => {
    const g = await insertGuardian(testPool());
    await expect(addStudent(appDb(), g, { firstName: 'A', grade: '9ano' })).rejects.toThrow('informe o primeiro nome do aluno');
    await expect(addStudent(appDb(), g, { firstName: 'Ana', grade: 'x' })).rejects.toThrow('escolha a série do aluno');
    await addStudent(appDb(), g, { firstName: 'Ana', grade: '9ano' });
    await expect(addStudent(appDb(), g, { firstName: 'ana', grade: '8ano' })).rejects.toThrow('já existe um aluno com esse nome');
  });

  it('edita o nome e a série; não deixa repetir o nome de outro aluno', async () => {
    const g = await insertGuardian(testPool());
    const ana = await addStudent(appDb(), g, { firstName: 'Ana', grade: '9ano' });
    await addStudent(appDb(), g, { firstName: 'Pedro', grade: '1serie' });
    await updateStudent(appDb(), g, ana, { firstName: 'Anabela', grade: '1serie' });
    expect((await listStudents(appDb(), g)).map((s) => [s.firstName, s.grade])).toEqual([['Anabela', '1serie'], ['Pedro', '1serie']]);
    await updateStudent(appDb(), g, ana, { firstName: 'anabela', grade: '2serie' }); // o próprio nome pode mudar de caixa
    await expect(updateStudent(appDb(), g, ana, { firstName: 'Pedro', grade: '9ano' })).rejects.toThrow('já existe um aluno com esse nome');
  });

  it('remove aluno sem aula; com aula na conta, recusa e o aluno continua', async () => {
    const t = await insertTeacher(testPool());
    const svc = await insertService(testPool(), t);
    const fam = await insertFamilyOrder(testPool(), t, svc);
    const free = await addStudent(appDb(), fam.guardianId, { firstName: 'Pedro', grade: '9ano' });
    expect((await listStudents(appDb(), fam.guardianId)).find((s) => s.id === fam.studentId)?.hasLessons).toBe(true);
    await removeStudent(appDb(), fam.guardianId, free);
    await expect(removeStudent(appDb(), fam.guardianId, fam.studentId)).rejects.toThrow('este aluno tem aulas na conta e não pode ser removido');
    expect((await listStudents(appDb(), fam.guardianId)).map((s) => s.id)).toEqual([fam.studentId]);
  });

  it('aluno de outro responsável: não edita nem remove', async () => {
    const g1 = await insertGuardian(testPool());
    const g2 = await insertGuardian(testPool());
    const other = await addStudent(appDb(), g2, { firstName: 'Ana', grade: '9ano' });
    await expect(updateStudent(appDb(), g1, other, { firstName: 'Bia', grade: '9ano' })).rejects.toThrow('aluno não encontrado');
    await expect(removeStudent(appDb(), g1, other)).rejects.toThrow('aluno não encontrado');
    await expect(removeStudent(appDb(), g1, 'nao-e-uuid')).rejects.toThrow('aluno não encontrado');
    expect((await listStudents(appDb(), g2)).map((s) => s.firstName)).toEqual(['Ana']);
  });
});
