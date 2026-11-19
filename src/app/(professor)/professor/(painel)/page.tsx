import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { missingForReview } from '@/domain/teachers/review';
import { appDeps, now } from '@/server/app';
import { requireTeacher } from '@/server/session';
import { submitForReviewAction } from './actions';
import { logoutAction } from '../entrar/actions';

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
  const deps = appDeps();
  const t = await deps.db.selectFrom('teachers').select(['display_name', 'status', 'slug'])
    .where('id', '=', teacherId).executeTakeFirstOrThrow();
  const missing = t.status === 'draft' ? await missingForReview(deps, teacherId, await now()) : [];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Olá, {t.display_name}</h1>
        <form action={logoutAction}><button className="btn-secondary">Sair</button></form>
      </div>
      <p className="text-slate-700">Situação: <strong data-testid="teacher-status">{STATUS[t.status] ?? t.status}</strong></p>
      {t.status === 'approved' && (
        <p className="notice">
          Sua página: <a className="text-brand underline" href={`/p/${t.slug}`}>{deps.config.appBaseUrl}/p/{t.slug}</a>
        </p>
      )}
      {t.status === 'draft' && (
        <section className="card space-y-3">
          <h2 className="font-medium">Para vender aulas</h2>
          {missing.length > 0 ? (
            <ul className="list-disc pl-5 text-sm text-slate-700">{missing.map((m) => <li key={m}>Falta: {m}</li>)}</ul>
          ) : (
            <p className="text-sm text-slate-700">Tudo pronto. Envie para a análise da equipe.</p>
          )}
          <ActionForm action={submitForReviewAction} submitLabel="Enviar para análise" className="space-y-3">
            <span />
          </ActionForm>
        </section>
      )}
      <nav className="grid gap-2 sm:grid-cols-2">
        <Link className="btn-secondary" href="/professor/cadastro">Perfil</Link>
        <Link className="btn-secondary" href="/professor/verificacao">Documentos</Link>
        <Link className="btn-secondary" href="/professor/recebimento">Conta de recebimento</Link>
        <Link className="btn-secondary" href="/professor/agenda">Agenda</Link>
        <Link className="btn-secondary" href="/professor/servicos">Serviços</Link>
        <Link className="btn-secondary" href="/professor/aulas">Aulas</Link>
      </nav>
    </div>
  );
}
