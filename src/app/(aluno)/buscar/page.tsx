import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchForm } from '@/components/aluno/SearchForm';
import { TeacherCard } from '@/components/aluno/TeacherCard';
import { ALERT, SECONDARY, TITLE } from '@/components/aluno/ui';
import { GRADE_LEVELS, SUBJECTS } from '@/domain/catalog';
import { searchTeachers } from '@/domain/search/teachers';
import { parseSearchForm, type SearchForm as Values } from '@/lib/search-form';
import { appDeps, now } from '@/server/app';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Buscar professores · Reforce' };

const PLACE: Record<Values['modality'], string> = {
  online: 'online',
  at_student: 'na sua casa',
  at_teacher: 'no endereço do professor',
};

function hrefFor(v: Values, change: Partial<Values>): string {
  const n = { ...v, ...change };
  const q = new URLSearchParams();
  if (n.subjectId) q.set('disciplina', String(n.subjectId));
  if (n.gradeId) q.set('serie', String(n.gradeId));
  q.set('modalidade', n.modality);
  if (n.cep && n.modality !== 'online') q.set('cep', n.cep);
  if (n.maxPriceCents) q.set('preco', String(n.maxPriceCents / 100));
  if (n.q) q.set('q', n.q);
  if (n.page > 1) q.set('pagina', String(n.page));
  return `/buscar?${q.toString()}`;
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const values = parseSearchForm(await searchParams);
  const subjects = SUBJECTS.map((s) => ({ id: s.id, name: s.name }));
  const grades = GRADE_LEVELS.map((g) => ({ id: g.id, name: g.name }));
  const form = <SearchForm subjects={subjects} grades={grades} values={values} advanced />;

  if (values.subjectId === null || values.gradeId === null) {
    return (
      <div className="space-y-5">
        <h1 className={TITLE}>Encontre um professor</h1>
        <p className="text-site-muted">Escolha a disciplina e a série para ver os professores com horário livre.</p>
        {form}
      </div>
    );
  }

  const subject = subjects.find((s) => s.id === values.subjectId)!.name;
  const grade = grades.find((g) => g.id === values.gradeId)!.name;
  const deps = appDeps();
  const result = await searchTeachers(deps, { ...values, subjectId: values.subjectId, gradeId: values.gradeId }, await now());

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className={TITLE}>{subject} · {grade}</h1>
        <p className="text-site-muted">Aulas {PLACE[values.modality]}{values.q ? ` · “${values.q}”` : ''}</p>
      </div>
      <details className="rounded-2xl border border-site-line px-4 py-1" open={!result.ok}>
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">Mudar a busca</summary>
        <div className="pb-4 pt-2">{form}</div>
      </details>

      {!result.ok ? (
        <p className={ALERT} role="alert">
          Não encontramos esse CEP. Confira os números ou procure aulas online.
        </p>
      ) : result.items.length === 0 ? (
        <div className="space-y-3 rounded-2xl bg-violet-50 p-5">
          <p className="font-semibold">Nenhum professor com horário livre para essa busca.</p>
          <ul className="space-y-2 text-sm">
            {values.modality !== 'online' && (
              <li><Link className="font-semibold text-indigo-600 underline" href={hrefFor(values, { modality: 'online', page: 1 })}>Ver professores de {subject} online</Link></li>
            )}
            {values.maxPriceCents && (
              <li><Link className="font-semibold text-indigo-600 underline" href={hrefFor(values, { maxPriceCents: null, page: 1 })}>Buscar sem preço máximo</Link></li>
            )}
            {values.q && (
              <li><Link className="font-semibold text-indigo-600 underline" href={hrefFor(values, { q: '', page: 1 })}>Buscar sem o texto “{values.q}”</Link></li>
            )}
            <li className="text-site-muted">Novos professores entram toda semana. Tente outra série ou volte em alguns dias.</li>
          </ul>
        </div>
      ) : (
        <>
          <p className="text-sm text-site-muted">
            {values.page > 1 ? `Página ${values.page}` : 'Professores verificados, com horário livre nos próximos dias.'}
          </p>
          <ul className="space-y-3">
            {result.items.map((item) => (
              <li key={item.teacherId}><TeacherCard item={item} viewerTzFallback="America/Sao_Paulo" /></li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            {values.page > 1 && <Link className={SECONDARY} href={hrefFor(values, { page: values.page - 1 })}>Voltar</Link>}
            {result.hasMore && <Link className={SECONDARY} href={hrefFor(values, { page: values.page + 1 })}>Ver mais professores</Link>}
          </div>
        </>
      )}
    </div>
  );
}
