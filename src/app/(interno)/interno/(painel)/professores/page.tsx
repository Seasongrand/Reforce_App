import Link from 'next/link';
import { TEACHER_STATUSES, teachersByStatus, type TeacherStatus } from '@/domain/staff/lists';
import { appDeps } from '@/server/app';
import { requireStaff } from '@/server/session';

export const dynamic = 'force-dynamic';

const LABEL: Record<TeacherStatus, string> = {
  draft: 'Cadastro incompleto', in_review: 'Em análise', approved: 'Aprovado', paused: 'Pausado', suspended: 'Suspenso',
};
const TONE: Record<TeacherStatus, string> = {
  draft: 'bg-slate-100 text-slate-700', in_review: 'bg-amber-50 text-amber-900', approved: 'bg-emerald-50 text-emerald-900',
  paused: 'bg-slate-100 text-slate-700', suspended: 'bg-red-50 text-red-800',
};
const CARD = 'rounded-[20px] border border-site-line bg-white p-5';
const pad = (n: number) => String(n).padStart(2, '0');

/** Professores por situação, com abas (?situacao=) e a contagem de cada uma. */
export default async function StaffTeachers({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  await requireStaff();
  const { situacao } = await searchParams;
  const filter = TEACHER_STATUSES.find((s) => s === situacao) ?? null;
  const { counts, teachers } = await teachersByStatus(appDeps().db);
  const shown = filter ? teachers.filter((t) => t.status === filter) : teachers;
  const tabs = [
    { key: null, label: 'Todos', count: teachers.length },
    ...TEACHER_STATUSES.map((s) => ({ key: s, label: LABEL[s], count: counts[s] })),
  ];
  return (
    <div className="space-y-6">
      <h1 className="font-display tracking-tight text-3xl font-normal">Professores</h1>
      <nav aria-label="Situação" className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const on = t.key === filter;
          return (
            <Link key={t.key ?? 'todos'} href={t.key ? `/interno/professores?situacao=${t.key}` : '/interno/professores'}
              aria-current={on ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-medium ${on ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-site-field bg-white text-site-muted'}`}>
              {t.label}
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${on ? 'bg-white text-indigo-800' : 'bg-slate-100 text-slate-700'}`}>{t.count}</span>
            </Link>
          );
        })}
      </nav>
      {shown.length === 0 ? (
        <p className={`${CARD} text-site-muted`}>{filter ? 'Nenhum professor nesta situação.' : 'Nenhum professor cadastrado ainda.'}</p>
      ) : (
        <ul className={`${CARD} divide-y divide-site-line py-1`}>
          {shown.map((t) => {
            const d = t.createdAt.toZonedDateTimeISO('America/Sao_Paulo');
            return (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3.5" data-testid={`professor-${t.slug}`}>
                <div className="min-w-0">
                  <p className="font-medium [overflow-wrap:anywhere]">{t.name}</p>
                  <p className="text-sm text-site-muted [overflow-wrap:anywhere]">
                    {t.email ?? 'sem e-mail'} · cadastro em {pad(d.day)}/{pad(d.month)}/{d.year}
                    {t.status === 'approved' && <> · <Link className="font-medium text-indigo-600 underline" href={`/p/${t.slug}`}>ver página</Link></>}
                    {t.status === 'in_review' && <> · <Link className="font-medium text-indigo-600 underline" href="/interno/verificacoes">ver documentos</Link></>}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TONE[t.status]}`}>{LABEL[t.status]}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
