import type { Metadata } from 'next';
import Link from 'next/link';
import { LocalWhen } from '@/components/aluno/LocalWhen';
import { accountView } from '@/domain/guardians/account';
import { appDeps, now } from '@/server/app';
import { requireGuardian } from '@/server/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Minha conta · Reforce' };

const CARD = 'flex flex-col gap-3 rounded-3xl border border-site-line bg-white p-5';
const BTN = 'inline-flex min-h-11 items-center self-start rounded-xl px-4 text-sm font-semibold';

/** Início de Minha conta: próxima aula, alunos e aulas esperando avaliação, cada um com o que fazer a seguir. */
export default async function GuardianHome() {
  const guardianId = await requireGuardian();
  const v = await accountView(appDeps(), guardianId, await now());
  const next = v.upcoming[0];
  const toReview = v.past.filter((l) => l.canReview);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold">Olá, {v.name.split(/\s+/)[0]}</h1>
          <p className="text-site-muted">Suas aulas e as dos alunos que você cadastrou.</p>
        </div>
        <Link href="/buscar" className={`${BTN} bg-indigo-600 text-white hover:bg-indigo-700`}>Buscar professor</Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className={CARD} data-testid="cartao-proxima" aria-labelledby="proxima">
          <h2 id="proxima" className="text-sm font-semibold text-site-muted">Próxima aula</h2>
          {next ? (
            <>
              <div>
                <p className="font-display text-xl font-bold">{next.subject} com {next.teacherName}</p>
                <p className="text-sm text-site-muted"><LocalWhen iso={next.startsAt} teacherTz={v.timezone} /> · {next.studentFirstName}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {next.lessonUrl && <a href={next.lessonUrl} className={`${BTN} bg-indigo-600 text-white`}>Página da aula</a>}
                <Link href="/conta/aulas" className={`${BTN} border border-site-field`}>Ver todas</Link>
              </div>
            </>
          ) : (
            <>
              <p className="font-display text-xl font-bold">Nenhuma aula marcada</p>
              <p className="text-sm text-site-muted">Escolha um professor, um horário e pague na hora, por PIX ou cartão.</p>
              <Link href="/buscar" className={`${BTN} border border-site-field`}>Buscar professor</Link>
            </>
          )}
        </section>

        <section className={CARD} data-testid="cartao-alunos" aria-labelledby="alunos">
          <h2 id="alunos" className="text-sm font-semibold text-site-muted">Alunos</h2>
          {v.students.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {v.students.map((s, i) => (
                <li key={i} className="rounded-xl border border-site-field px-3 py-2 text-sm"><strong>{s.firstName}</strong> · {s.grade}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-site-muted">Nenhum aluno cadastrado ainda. Guardamos só o primeiro nome e a série.</p>
          )}
          <Link href="/conta/alunos" className={`${BTN} border border-site-field`}>{v.students.length > 0 ? 'Gerenciar alunos' : 'Cadastrar aluno'}</Link>
        </section>

        <section className={`${CARD} lg:col-span-2`} data-testid="cartao-avaliar" aria-labelledby="avaliar">
          <h2 id="avaliar" className="text-sm font-semibold text-site-muted">Avaliações</h2>
          {toReview.length === 0 ? (
            <p className="text-sm text-site-muted">Nenhuma aula esperando avaliação.</p>
          ) : (
            <>
              <p className="font-display text-xl font-bold">
                {toReview.length === 1 ? '1 aula esperando sua avaliação' : `${toReview.length} aulas esperando sua avaliação`}
              </p>
              <p className="text-sm text-site-muted">Sua nota ajuda outras famílias a escolher.</p>
              <Link href={toReview.length === 1 ? `/conta/avaliar/${toReview[0]!.bookingId}` : '/conta/aulas?aba=anteriores'}
                className={`${BTN} bg-yellow-400 text-indigo-950`}>
                {toReview.length === 1 ? 'Avaliar a aula' : 'Ver as aulas'}
              </Link>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
