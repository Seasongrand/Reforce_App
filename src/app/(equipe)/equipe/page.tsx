import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { config } from '@/config';
import { teamPasswordMatches } from '@/domain/team-auth';
import { teamOverview, type TeamOverview } from '@/domain/team-view';
import { WAITLIST_SUBJECTS } from '@/domain/waitlist';
import { siteDeps } from '@/server/app';

export const dynamic = 'force-dynamic';

type Tab = 'professores' | 'alunos';
type Search = { aba?: string; q?: string; uf?: string; disciplina?: string };

const CARD = 'rounded-2xl border border-site-line bg-white p-4 sm:p-5';
const FIELD =
  'block min-h-11 w-full rounded-xl border border-site-field bg-white px-3 text-[15px] font-normal focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/30';
const ACTION = 'inline-flex min-h-10 items-center rounded-xl border border-site-field px-3 text-sm font-semibold hover:bg-violet-50';
const CITY_ROWS = 10;

const when = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));

function Count({ label, n }: { label: string; n: number }) {
  return (
    <div className={CARD}>
      <p className="text-sm text-site-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold" data-testid={`total-${label}`}>{n}</p>
    </div>
  );
}

function Breakdown({ title, first, rows }: { title: string; first: string; rows: { name: string; teachers: number; students: number }[] }) {
  return (
    <section className={CARD}>
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-site-muted">Ainda não há inscrições.</p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-site-muted">
              <th className="py-1.5 font-medium">{first}</th>
              <th className="py-1.5 text-right font-medium">Professores</th>
              <th className="py-1.5 text-right font-medium">Alunos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-site-line">
                <td className="py-1.5">{r.name}</td>
                <td className="py-1.5 text-right font-semibold tabular-nums">{r.teachers}</td>
                <td className="py-1.5 text-right tabular-nums">{r.students}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <li key={s} className="rounded-lg bg-violet-50 px-2 py-1 text-[13px] font-medium">{s}</li>
      ))}
    </ul>
  );
}

function Teachers({ list }: { list: TeamOverview['teachers'] }) {
  return (
    <ul className="space-y-3">
      {list.map((t) => (
        <li key={t.id} className={`${CARD} space-y-2.5`} data-testid="professor">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-[17px] font-semibold">{t.name}</p>
            <p className="text-[13px] text-site-muted">{t.city}/{t.state} · {when(t.createdAt)}</p>
          </div>
          <Chips items={t.subjects} />
          <p className="text-sm text-site-muted">{[t.stages.join(', '), t.modalities.join(', '), t.education].join(' · ')}</p>
          {t.notes && <p className="whitespace-pre-line border-l-2 border-site-line pl-3 text-sm">{t.notes}</p>}
          <div className="flex flex-wrap gap-2">
            {t.whatsappUrl && <a className={ACTION} href={t.whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a>}
            <a className={ACTION} href={`mailto:${encodeURIComponent(t.email)}`}>{t.email}</a>
            {t.cvUrl && <a className={ACTION} href={t.cvUrl}>Currículo</a>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Students({ list }: { list: TeamOverview['students'] }) {
  return (
    <ul className="space-y-3">
      {list.map((s) => (
        <li key={s.email} className={`${CARD} space-y-2`} data-testid="aluno">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <a className="text-[17px] font-semibold text-indigo-600 underline" href={`mailto:${encodeURIComponent(s.email)}`}>{s.email}</a>
            <p className="text-[13px] text-site-muted">{s.city}/{s.state} · {when(s.createdAt)}</p>
          </div>
          <Chips items={s.subjects} />
          <p className="text-sm text-site-muted">{s.stages.join(', ')}</p>
        </li>
      ))}
    </ul>
  );
}

/**
 * Página da equipe: as inscrições das listas de espera (professores e alunos),
 * com o resumo por cidade e disciplina. A senha é a das planilhas, pedida pelo
 * proxy; a página confere de novo.
 */
export default async function TeamPage({ searchParams }: { searchParams: Promise<Search> }) {
  const authorization = (await headers()).get('authorization');
  if (!teamPasswordMatches(config().waitlistExportPassword, authorization)) notFound();

  const sp = await searchParams;
  const tab: Tab = sp.aba === 'alunos' ? 'alunos' : 'professores';
  const subjectId = Number(sp.disciplina) || undefined;
  const filters = { q: sp.q?.trim() || undefined, uf: sp.uf || undefined, subjectId };
  const v = await teamOverview(siteDeps(), filters);
  const filtering = Boolean(filters.q || filters.uf || filters.subjectId);
  const href = (aba: Tab) => {
    const p = new URLSearchParams({ aba });
    if (filters.q) p.set('q', filters.q);
    if (filters.uf) p.set('uf', filters.uf);
    if (filters.subjectId) p.set('disciplina', String(filters.subjectId));
    return `/equipe?${p}`;
  };
  const tabClass = (on: boolean) =>
    `inline-flex min-h-11 items-center rounded-xl px-4 text-[15px] font-semibold ${on ? 'bg-indigo-950 text-white' : 'border border-site-field bg-white hover:bg-violet-50'}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold">Listas de espera</h1>
          <p className="text-site-muted">Professores inscritos e alunos que pediram aviso da abertura.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className={ACTION} href="/api/lista-de-espera.csv">Planilha dos professores</a>
          <a className={ACTION} href="/api/lista-de-espera/alunos.csv">Planilha dos alunos</a>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Count label="Professores" n={v.totals.teachers} />
        <Count label="Alunos" n={v.totals.students} />
        <Count label="Currículos" n={v.totals.withCv} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Breakdown
            title="Por cidade"
            first="Cidade"
            rows={v.byCity.slice(0, CITY_ROWS).map((c) => ({ name: `${c.city}/${c.state}`, teachers: c.teachers, students: c.students }))}
          />
          {v.byCity.length > CITY_ROWS && (
            <p className="px-1 text-[13px] text-site-muted">E mais {v.byCity.length - CITY_ROWS} cidades: use os filtros abaixo.</p>
          )}
        </div>
        <Breakdown title="Por disciplina" first="Disciplina" rows={v.bySubject.map((s) => ({ name: s.subject, ...s }))} />
      </div>

      <form method="get" action="/equipe" className={`${CARD} grid gap-3 sm:grid-cols-[2fr_1fr_1.5fr_auto] sm:items-end`}>
        <input type="hidden" name="aba" value={tab} />
        <label className="space-y-1.5 text-sm font-semibold">
          Buscar
          <input className={FIELD} name="q" defaultValue={filters.q} placeholder="Nome, e-mail ou cidade" />
        </label>
        <label className="space-y-1.5 text-sm font-semibold">
          UF
          <select className={FIELD} name="uf" defaultValue={filters.uf ?? ''}>
            <option value="">Todas</option>
            {v.states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-semibold">
          Disciplina
          <select className={FIELD} name="disciplina" defaultValue={filters.subjectId ? String(filters.subjectId) : ''}>
            <option value="">Todas</option>
            {WAITLIST_SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" className="min-h-11 rounded-xl bg-indigo-600 px-5 font-semibold text-white hover:bg-indigo-700">Filtrar</button>
          {filtering && <Link className={ACTION} href={`/equipe?aba=${tab}`}>Limpar</Link>}
        </div>
      </form>

      <nav aria-label="Listas" className="flex flex-wrap gap-2">
        <Link href={href('professores')} className={tabClass(tab === 'professores')} aria-current={tab === 'professores' ? 'page' : undefined}>
          Professores ({v.teachers.length})
        </Link>
        <Link href={href('alunos')} className={tabClass(tab === 'alunos')} aria-current={tab === 'alunos' ? 'page' : undefined}>
          Alunos ({v.students.length})
        </Link>
      </nav>

      {(tab === 'professores' ? v.teachers.length : v.students.length) === 0 ? (
        <p className={`${CARD} text-site-muted`}>
          {filtering ? 'Nenhuma inscrição com esses filtros.' : 'Ainda não há inscrições nesta lista.'}
        </p>
      ) : tab === 'professores' ? (
        <Teachers list={v.teachers} />
      ) : (
        <Students list={v.students} />
      )}
    </div>
  );
}
