import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountLessonCard, Stars } from '@/components/aluno/AccountLessonCard';
import { accountView } from '@/domain/guardians/account';
import { appDeps, now } from '@/server/app';
import { requireGuardian } from '@/server/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Aulas · Minha conta · Reforce' };

const STATUS: Record<string, string> = { completed: 'Concluída', no_show: 'Falta registrada', confirmed: 'Aguardando' };
const BTN = 'inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold';
const EMPTY = 'rounded-3xl border border-site-line bg-white p-5 text-site-muted';

/** Aulas em duas abas: Próximas (a mais perto primeiro) e Anteriores (a mais recente primeiro). */
export default async function GuardianLessons({ searchParams }: { searchParams: Promise<{ aba?: string; avaliada?: string; remarcada?: string; cancelada?: string }> }) {
  const guardianId = await requireGuardian();
  const v = await accountView(appDeps(), guardianId, await now());
  const { aba, avaliada, remarcada, cancelada } = await searchParams;
  const tab = aba === 'anteriores' ? 'past' : 'upcoming';
  const tabs = [
    { key: 'upcoming', label: 'Próximas', href: '/conta/aulas', count: v.upcoming.length },
    { key: 'past', label: 'Anteriores', href: '/conta/aulas?aba=anteriores', count: v.past.length },
  ] as const;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Aulas</h1>
      {avaliada && <p className="rounded-2xl bg-green-100 px-4 py-3 text-sm font-semibold text-green-800" role="status">Obrigado pela avaliação!</p>}
      {remarcada && <p className="rounded-2xl bg-green-100 px-4 py-3 text-sm font-semibold text-green-800" role="status">Aula remarcada. O professor já foi avisado.</p>}
      {cancelada && <p className="rounded-2xl bg-green-100 px-4 py-3 text-sm font-semibold text-green-800" role="status">Aula cancelada. A devolução sai pelo mesmo meio de pagamento, e o professor já foi avisado.</p>}
      <nav aria-label="Aulas" className="flex gap-2 border-b border-site-line">
        {tabs.map((t) => (
          <Link key={t.key} href={t.href} aria-current={tab === t.key ? 'page' : undefined}
            className={`-mb-px flex min-h-11 items-center gap-2 border-b-2 px-3 font-semibold ${tab === t.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-site-muted hover:text-indigo-950'}`}>
            {t.label}
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tab === t.key ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>{t.count}</span>
          </Link>
        ))}
      </nav>

      {tab === 'upcoming' ? (
        v.upcoming.length === 0 ? (
          <p className={EMPTY}>Nenhuma aula marcada. <Link href="/buscar" className="font-semibold text-indigo-600 underline">Buscar professor</Link></p>
        ) : (
          <ul className="space-y-3">
            {v.upcoming.map((l) => (
              <AccountLessonCard key={l.bookingId} l={l} tz={v.timezone}>
                <div className="flex flex-wrap gap-2">
                  {l.lessonUrl && <a href={l.lessonUrl} className={`${BTN} bg-indigo-600 text-white`}>Página da aula</a>}
                  <a href={`/pedido/${l.orderId}/agenda.ics`} download="aula-reforce.ics" className={`${BTN} border border-site-field`}>Adicionar à agenda</a>
                  <Link href={`/conta/aulas/${l.bookingId}`} className={`${BTN} border border-site-field`}>Remarcar ou cancelar</Link>
                </div>
              </AccountLessonCard>
            ))}
          </ul>
        )
      ) : v.past.length === 0 ? (
        <p className={EMPTY}>As aulas que já aconteceram aparecem aqui, para você avaliar e marcar de novo.</p>
      ) : (
        <ul className="space-y-3">
          {v.past.map((l) => (
            <AccountLessonCard key={l.bookingId} l={l} tz={v.timezone}>
              <p className="text-sm text-site-muted">{STATUS[l.status] ?? l.status}</p>
              {l.review && (
                <p className="text-sm"><Stars n={l.review.rating} /> <span className="text-site-muted">Sua avaliação{l.review.comment ? `: “${l.review.comment}”` : ''}</span></p>
              )}
              <div className="flex flex-wrap gap-2">
                {l.canReview && <Link href={`/conta/avaliar/${l.bookingId}`} className={`${BTN} bg-yellow-400 text-indigo-950`}>Avaliar a aula</Link>}
                <Link href={`/p/${l.teacherSlug}`} className={`${BTN} border border-site-field`}>Marcar de novo</Link>
              </div>
            </AccountLessonCard>
          ))}
        </ul>
      )}
    </div>
  );
}
