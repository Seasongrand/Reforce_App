import Link from 'next/link';
import { appDeps } from '@/server/app';
import { requireTeacher } from '@/server/session';
import { logoutAction } from './entrar/actions';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, string> = {
  draft: 'Cadastro em preenchimento',
  in_review: 'Em análise pela equipe',
  approved: 'Aprovado',
  paused: 'Pausado',
  suspended: 'Suspenso',
};

export default async function TeacherHome() {
  const teacherId = await requireTeacher();
  const t = await appDeps().db.selectFrom('teachers').select(['display_name', 'status', 'slug'])
    .where('id', '=', teacherId).executeTakeFirstOrThrow();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Olá, {t.display_name}</h1>
        <form action={logoutAction}><button className="btn-secondary">Sair</button></form>
      </div>
      <p className="text-slate-700">Situação: <strong data-testid="teacher-status">{STATUS[t.status] ?? t.status}</strong></p>
      <nav className="grid gap-2">
        <Link className="btn-secondary" href="/professor/cadastro">Perfil</Link>
      </nav>
    </div>
  );
}
