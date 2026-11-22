import { ActionForm } from '@/components/ActionForm';
import { requireTeacher } from '@/server/session';
import { saveNameAction } from '../actions';

export const dynamic = 'force-dynamic';

/** Primeiro acesso do professor: só o nome; o resto do perfil vem pelos passos do Início. */
export default async function WelcomePage() {
  await requireTeacher();
  return (
    <div className="max-w-lg space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium text-indigo-600">Bem-vindo à Reforce</p>
        <h1 className="font-display tracking-tight text-3xl font-normal">Como você quer ser chamado?</h1>
        <p className="text-site-muted">É o nome que os alunos e as famílias vão ver na sua página. Depois são 7 passos, cerca de 15 minutos, até a sua primeira aula.</p>
      </div>
      <ActionForm action={saveNameAction} submitLabel="Continuar" className="card space-y-4">
        <label className="grid gap-1.5 text-sm font-medium" htmlFor="nome">Seu nome
          <input id="nome" name="nome" required minLength={3} maxLength={80} autoComplete="name" className="input" placeholder="Ana Souza" />
        </label>
      </ActionForm>
    </div>
  );
}
