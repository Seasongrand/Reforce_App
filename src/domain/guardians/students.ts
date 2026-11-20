/**
 * Alunos em Minha conta: o responsável cadastra, edita e remove os alunos.
 * Só primeiro nome e série ("menores sem login"). Aluno com aula na conta não
 * é removido (os pedidos apontam para ele).
 */
import { sql } from 'kysely';
import type { Db } from '@/db/client';
import { GRADE_LEVELS, gradeName } from '../catalog';
import { DomainError } from '../errors';

export interface GuardianStudent {
  id: string;
  firstName: string;
  grade: string;
  gradeName: string;
  hasLessons: boolean;
}

const UUID = /^[0-9a-f-]{36}$/i;

function clean(input: { firstName: string; grade: string }): { firstName: string; grade: string } {
  const firstName = input.firstName.trim().split(/\s+/)[0] ?? '';
  if (firstName.length < 2) throw new DomainError('invalid', 'informe o primeiro nome do aluno');
  if (!GRADE_LEVELS.some((g) => g.slug === input.grade)) throw new DomainError('invalid', 'escolha a série do aluno');
  return { firstName, grade: input.grade };
}

async function ownStudent(db: Db, guardianId: string, studentId: string): Promise<void> {
  const s = UUID.test(studentId)
    ? await db.selectFrom('students').select('id').where('id', '=', studentId).where('guardian_id', '=', guardianId).executeTakeFirst()
    : undefined;
  if (!s) throw new DomainError('not_found', 'aluno não encontrado');
}

async function nameTaken(db: Db, guardianId: string, firstName: string, exceptId: string | null): Promise<boolean> {
  const r = await sql<{ id: string }>`
    SELECT id FROM students WHERE guardian_id = ${guardianId} AND lower(first_name) = lower(${firstName})
       AND (${exceptId}::uuid IS NULL OR id <> ${exceptId}::uuid) LIMIT 1`.execute(db);
  return r.rows.length > 0;
}

export async function listStudents(db: Db, guardianId: string): Promise<GuardianStudent[]> {
  const { rows } = await sql<{ id: string; first_name: string; grade: string | null; has_lessons: boolean }>`
    SELECT s.id, s.first_name, s.grade, EXISTS (SELECT 1 FROM orders o WHERE o.student_id = s.id) AS has_lessons
      FROM students s WHERE s.guardian_id = ${guardianId}
     ORDER BY lower(s.first_name), s.id`.execute(db);
  return rows.map((r) => ({
    id: r.id, firstName: r.first_name, grade: r.grade ?? '', gradeName: gradeName(r.grade), hasLessons: r.has_lessons,
  }));
}

export async function addStudent(db: Db, guardianId: string, input: { firstName: string; grade: string }): Promise<string> {
  const s = clean(input);
  if (await nameTaken(db, guardianId, s.firstName, null)) throw new DomainError('conflict', 'já existe um aluno com esse nome');
  const r = await db.insertInto('students').values({ guardian_id: guardianId, first_name: s.firstName, grade: s.grade })
    .returning('id').executeTakeFirstOrThrow();
  return r.id;
}

export async function updateStudent(
  db: Db, guardianId: string, studentId: string, input: { firstName: string; grade: string },
): Promise<void> {
  await ownStudent(db, guardianId, studentId);
  const s = clean(input);
  if (await nameTaken(db, guardianId, s.firstName, studentId)) throw new DomainError('conflict', 'já existe um aluno com esse nome');
  await db.updateTable('students').set({ first_name: s.firstName, grade: s.grade })
    .where('id', '=', studentId).where('guardian_id', '=', guardianId).execute();
}

export async function removeStudent(db: Db, guardianId: string, studentId: string): Promise<void> {
  await ownStudent(db, guardianId, studentId);
  const used = await db.selectFrom('orders').select('id').where('student_id', '=', studentId).executeTakeFirst();
  if (used) throw new DomainError('conflict', 'este aluno tem aulas na conta e não pode ser removido');
  await db.deleteFrom('students').where('id', '=', studentId).where('guardian_id', '=', guardianId).execute();
}
