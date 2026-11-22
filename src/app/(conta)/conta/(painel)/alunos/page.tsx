import type { Metadata } from 'next';
import { ActionForm } from '@/components/ActionForm';
import { INPUT, LABEL } from '@/components/aluno/ui';
import { GRADE_LEVELS } from '@/domain/catalog';
import { listStudents } from '@/domain/guardians/students';
import { appDeps } from '@/server/app';
import { requireGuardian } from '@/server/session';
import { addStudentAction, removeStudentAction, updateStudentAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Alunos · Minha conta · Reforce' };

const CARD = 'rounded-[20px] border border-site-line bg-white p-5';
const SAVE = 'inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60';
const QUIET = 'inline-flex min-h-11 items-center rounded-xl border border-site-field px-4 text-sm font-medium text-indigo-950 hover:bg-violet-50 disabled:opacity-60';

function StudentFields({ firstName, grade }: { firstName?: string; grade?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={LABEL}>Primeiro nome<input className={INPUT} name="firstName" required defaultValue={firstName} /></label>
      <label className={LABEL}>Série
        <select className={INPUT} name="grade" required defaultValue={grade ?? ''}>
          <option value="" disabled>Escolha a série</option>
          {GRADE_LEVELS.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
        </select>
      </label>
    </div>
  );
}

/** Alunos do responsável: cadastrar, editar e remover (só primeiro nome e série). */
export default async function GuardianStudents() {
  const guardianId = await requireGuardian();
  const students = await listStudents(appDeps().db, guardianId);
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-display tracking-tight text-3xl font-normal">Alunos</h1>
        <p className="text-site-muted">Guardamos só o primeiro nome e a série. O aluno não tem login: a conta é sua.</p>
      </div>

      {students.length === 0 ? (
        <p className={`${CARD} text-site-muted`}>Nenhum aluno cadastrado ainda.</p>
      ) : (
        <ul className="space-y-3">
          {students.map((s) => (
            <li key={s.id} className={`${CARD} space-y-3`} data-testid={`aluno-${s.firstName}`}>
              <p><strong className="font-display tracking-tight text-lg">{s.firstName}</strong> <span className="text-site-muted">· {s.gradeName}</span></p>
              <details className="group">
                <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-indigo-600">Editar</summary>
                <ActionForm action={updateStudentAction} submitLabel="Salvar" successMessage="Aluno atualizado." className="mt-2 space-y-3" buttonClassName={SAVE}>
                  <input type="hidden" name="studentId" value={s.id} />
                  <StudentFields firstName={s.firstName} grade={s.grade} />
                </ActionForm>
              </details>
              {s.hasLessons ? (
                <p className="text-sm text-site-muted">Tem aulas na conta, por isso não pode ser removido.</p>
              ) : (
                <ActionForm action={removeStudentAction} submitLabel="Remover" className="" buttonClassName={QUIET}>
                  <input type="hidden" name="studentId" value={s.id} />
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      )}

      <section className={CARD} aria-labelledby="novo-aluno">
        <h2 id="novo-aluno" className="mb-4 font-display tracking-tight text-xl font-normal">Cadastrar aluno</h2>
        <ActionForm action={addStudentAction} submitLabel="Cadastrar aluno" className="space-y-4" buttonClassName={SAVE}>
          <StudentFields />
        </ActionForm>
      </section>
    </div>
  );
}
