import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LocalWhen } from '@/components/aluno/LocalWhen';
import { TeacherPhoto } from '@/components/aluno/TeacherPhoto';
import { TITLE } from '@/components/aluno/ui';
import { accountView, type AccountLesson } from '@/domain/guardians/account';
import { appDeps, now } from '@/server/app';
import { currentSubject } from '@/server/session';
import { logoutAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Minha conta · Reforce' };

const PLACE: Record<AccountLesson['modality'], string> = {
  online: 'online',
  at_student: 'na sua casa',
  at_teacher: 'no endereço do professor',
};
const STATUS: Record<string, string> = { completed: 'Concluída', no_show: 'Falta registrada', confirmed: 'Aguardando' };

function Stars({ n }: { n: number }) {
  return <span aria-label={`${n} de 5`} className="tracking-tight text-yellow-500">{'★'.repeat(n)}<span className="text-site-line">{'★'.repeat(5 - n)}</span></span>;
}

function LessonCard({ l, tz, children }: { l: AccountLesson; tz: string; children: React.ReactNode }) {
  return (
    <li className="space-y-3 rounded-2xl border border-site-line p-4" data-testid={`aula-${l.bookingId}`}>
      <div className="flex items-center gap-3">
        <TeacherPhoto photoUrl={l.teacherPhotoUrl} name={l.teacherName} size={48} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{l.subject} com {l.teacherName}</p>
          <p className="text-[13px] text-site-muted">
            <LocalWhen iso={l.startsAt} teacherTz={tz} /> · {PLACE[l.modality]} · {l.studentFirstName}
          </p>
        </div>
      </div>
      {children}
    </li>
  );
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ avaliada?: string }> }) {
  const guardianId = await currentSubject('guardian');
  if (!guardianId) redirect('/conta/entrar');
  const v = await accountView(appDeps(), guardianId, await now());
  const { avaliada } = await searchParams;
  const btn = 'inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold';
  return (
    <div className="space-y-7">
      <div>
        <h1 className={TITLE}>Olá, {v.name.split(/\s+/)[0]}</h1>
        <p className="text-[15px] text-site-muted">Suas aulas e as dos alunos que você cadastrou.</p>
      </div>

      {avaliada && <p className="rounded-2xl bg-green-100 px-4 py-3 text-sm font-semibold text-green-800" role="status">Obrigado pela avaliação!</p>}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Próximas aulas</h2>
        {v.upcoming.length === 0 ? (
          <p className="text-site-muted">Nenhuma aula marcada. <Link href="/buscar" className="font-semibold text-indigo-600 underline">Buscar professor</Link></p>
        ) : (
          <ul className="space-y-3">
            {v.upcoming.map((l) => (
              <LessonCard key={l.bookingId} l={l} tz={v.timezone}>
                <div className="flex flex-wrap gap-2">
                  {l.lessonUrl && <a href={l.lessonUrl} className={`${btn} bg-indigo-600 text-white`}>Página da aula</a>}
                  <a href={`/pedido/${l.orderId}/agenda.ics`} download="aula-reforce.ics" className={`${btn} border border-site-field`}>Adicionar à agenda</a>
                </div>
              </LessonCard>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Aulas anteriores</h2>
        {v.past.length === 0 ? (
          <p className="text-site-muted">As aulas que já aconteceram aparecem aqui, para você avaliar e marcar de novo.</p>
        ) : (
          <ul className="space-y-3">
            {v.past.map((l) => (
              <LessonCard key={l.bookingId} l={l} tz={v.timezone}>
                <p className="text-[13px] text-site-muted">{STATUS[l.status] ?? l.status}</p>
                {l.review && (
                  <p className="text-sm"><Stars n={l.review.rating} /> <span className="text-site-muted">Sua avaliação{l.review.comment ? `: “${l.review.comment}”` : ''}</span></p>
                )}
                <div className="flex flex-wrap gap-2">
                  {l.canReview && <Link href={`/conta/avaliar/${l.bookingId}`} className={`${btn} bg-yellow-400 text-indigo-950`}>Avaliar a aula</Link>}
                  <Link href={`/p/${l.teacherSlug}`} className={`${btn} border border-site-field`}>Marcar de novo</Link>
                </div>
              </LessonCard>
            ))}
          </ul>
        )}
      </section>

      {v.students.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-xl font-bold">Alunos</h2>
          <ul className="flex flex-wrap gap-2">
            {v.students.map((s, i) => (
              <li key={i} className="rounded-xl border border-site-field px-3 py-2 text-sm"><strong>{s.firstName}</strong> · {s.grade}</li>
            ))}
          </ul>
        </section>
      )}

      <form action={logoutAction} className="border-t border-site-line pt-5">
        <button className="inline-flex min-h-11 items-center rounded-xl border border-site-field px-4 text-sm font-semibold text-indigo-950 hover:bg-violet-50">
          Sair da conta
        </button>
      </form>
    </div>
  );
}
