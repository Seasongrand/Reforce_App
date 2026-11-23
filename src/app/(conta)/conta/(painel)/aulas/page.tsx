import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountLessonCard, Stars } from '@/components/aluno/AccountLessonCard';
import { accountView } from '@/domain/guardians/account';
import { weeklySeriesOf } from '@/domain/booking/weekly';
import { ActionForm } from '@/components/ActionForm';
import { LocalWhen } from '@/components/aluno/LocalWhen';
import { endWeeklyAction } from '../actions';
import { appDeps, now } from '@/server/app';
import { requireGuardian } from '@/server/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Aulas · Minha conta · Reforce' };

const STATUS: Record<string, string> = { completed: 'Concluída', no_show: 'Falta registrada', confirmed: 'Aguardando' };
const BTN = 'inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-medium';
const WEEKDAYS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
const EMPTY = 'rounded-[20px] border border-site-line bg-white p-5 text-site-muted';

/** Aulas em duas abas: Próximas (a mais perto primeiro) e Anteriores (a mais recente primeiro). */
export default async function GuardianLessons({ searchParams }: { searchParams: Promise<{ aba?: string; avaliada?: string; remarcada?: string; cancelada?: string; fixo?: string; 'fixo-encerrado'?: string }> }) {
  const guardianId = await requireGuardian();
  const at = await now();
  const v = await accountView(appDeps(), guardianId, at);
  const weekly = await weeklySeriesOf(appDeps().db, guardianId, at);
  const sp = await searchParams;
  const { aba, avaliada, remarcada, cancelada } = sp;
  const tab = aba === 'anteriores' ? 'past' : 'upcoming';
  const tabs = [
    { key: 'upcoming', label: 'Próximas', href: '/conta/aulas', count: v.upcoming.length },
    { key: 'past', label: 'Anteriores', href: '/conta/aulas?aba=anteriores', count: v.past.length },
  ] as const;
  return (
    <div className="space-y-6">
      <h1 className="font-display tracking-tight text-3xl font-normal">Aulas</h1>
      {avaliada && <p className="rounded-[20px] bg-green-100 px-4 py-3 text-sm font-medium text-green-800" role="status">Obrigado pela avaliação!</p>}
      {remarcada && <p className="rounded-[20px] bg-green-100 px-4 py-3 text-sm font-medium text-green-800" role="status">Aula remarcada. O professor já foi avisado.</p>}
      {cancelada && <p className="rounded-[20px] bg-green-100 px-4 py-3 text-sm font-medium text-green-800" role="status">Aula cancelada. A devolução sai pelo mesmo meio de pagamento, e o professor já foi avisado.</p>}
      {sp.fixo && <p className="rounded-[20px] bg-green-100 px-4 py-3 text-sm font-medium text-green-800" role="status">Horário fixo ligado. O PIX de cada semana chega 5 dias antes da aula.</p>}
      {sp['fixo-encerrado'] && <p className="rounded-[20px] bg-green-100 px-4 py-3 text-sm font-medium text-green-800" role="status">Horário fixo encerrado. As aulas já pagas continuam marcadas.</p>}
      {weekly.length > 0 && (
        <section className="space-y-3" aria-labelledby="fixos">
          <h2 id="fixos" className="font-display text-xl font-normal tracking-tight">Horário fixo</h2>
          <ul className="space-y-3">
            {weekly.map((w) => (
              <li key={w.id} className="space-y-3 rounded-[20px] border border-indigo-200 bg-white p-5" data-testid="horario-fixo">
                <p className="font-medium">Toda {WEEKDAYS[w.weekday - 1]}, às {w.time} · {w.subject} com {w.teacherName} · {w.studentFirstName}</p>
                {w.nextToPay ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg bg-violet-50 px-3 py-2 text-sm">
                    <span>Aula de <LocalWhen iso={w.nextToPay.startsAt} teacherTz={v.timezone} /> reservada. Pague até <LocalWhen iso={w.nextToPay.payUntil} teacherTz={v.timezone} />.</span>
                    <Link href={`/pedido/${w.nextToPay.orderId}`} className={`${BTN} bg-indigo-600 text-white hover:bg-indigo-700`}>Pagar a aula</Link>
                  </div>
                ) : (
                  <p className="text-sm text-site-muted">A aula da próxima semana é reservada automaticamente, e o PIX chega 5 dias antes.</p>
                )}
                <details>
                  <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-site-muted underline">Encerrar horário fixo</summary>
                  <ActionForm action={endWeeklyAction} submitLabel="Encerrar" className="mt-2 space-y-3"
                    buttonClassName="inline-flex min-h-11 items-center rounded-lg border border-red-300 bg-white px-4 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50">
                    <input type="hidden" name="seriesId" value={w.id} />
                    <label className="flex min-h-11 items-start gap-2.5 text-sm">
                      <input type="checkbox" name="confirm" required className="mt-0.5 size-5 flex-none accent-indigo-600" />
                      Encerrar o horário fixo. A aula reservada e ainda não paga é liberada; as já pagas continuam.
                    </label>
                  </ActionForm>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
      <nav aria-label="Aulas" className="flex gap-2 border-b border-site-line">
        {tabs.map((t) => (
          <Link key={t.key} href={t.href} aria-current={tab === t.key ? 'page' : undefined}
            className={`-mb-px flex min-h-11 items-center gap-2 border-b-2 px-3 font-medium ${tab === t.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-site-muted hover:text-indigo-950'}`}>
            {t.label}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tab === t.key ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>{t.count}</span>
          </Link>
        ))}
      </nav>

      {tab === 'upcoming' ? (
        v.upcoming.length === 0 ? (
          <p className={EMPTY}>Nenhuma aula marcada. <Link href="/buscar" className="font-medium text-indigo-600 underline">Buscar professor</Link></p>
        ) : (
          <ul className="space-y-3">
            {v.upcoming.map((l) => (
              <AccountLessonCard key={l.bookingId} l={l} tz={v.timezone}>
                <div className="flex flex-wrap gap-2">
                  {l.lessonUrl && <a href={l.lessonUrl} className={`${BTN} bg-indigo-600 text-white`}>Página da aula</a>}
                  <a href={`/pedido/${l.orderId}/agenda.ics`} download="aula-reforce.ics" className={`${BTN} border border-site-field`}>Adicionar à agenda</a>
                  <Link href={`/conta/aulas/${l.bookingId}`} className={`${BTN} border border-site-field`}>Remarcar ou cancelar</Link>
                  {!l.seriesId && <Link href={`/conta/horario-fixo/${l.bookingId}`} className={`${BTN} border border-site-field`}>Repetir toda semana</Link>}
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
                {l.canReview && <Link href={`/conta/avaliar/${l.bookingId}`} className={`${BTN} bg-indigo-600 text-white hover:bg-indigo-700`}>Avaliar a aula</Link>}
                <Link href={`/p/${l.teacherSlug}`} className={`${BTN} border border-site-field`}>Marcar de novo</Link>
              </div>
            </AccountLessonCard>
          ))}
        </ul>
      )}
    </div>
  );
}
