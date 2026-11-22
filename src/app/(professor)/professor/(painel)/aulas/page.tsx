import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { splitLessons, teacherLessons } from '@/domain/teachers/lessons';
import { formatBRL } from '@/lib/money';
import { formatPtBr } from '@/time/zoned';
import { appDeps, now } from '@/server/app';
import { requireTeacher } from '@/server/session';
import { cancelLessonByTeacherAction, checkinAction, joinRoomAction, refundNoShowAction } from './actions';

export const dynamic = 'force-dynamic';

/** Quantos dias de aulas anteriores a aba mostra. */
const PAST_DAYS = 90;
const MODALITY: Record<string, string> = { online: 'Online', at_teacher: 'No seu endereço', at_student: 'Na casa do aluno' };
const STATUS: Record<string, string> = {
  confirmed: 'Confirmada', completed: 'Concluída', no_show: 'Aluno faltou', cancelled: 'Cancelada',
};
const CARD = 'rounded-[20px] border border-site-line bg-white p-5';

/** Aulas em duas abas: Próximas (a mais perto primeiro) e Anteriores (a mais recente primeiro). */
export default async function TeacherLessonsPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const teacherId = await requireTeacher();
  const deps = appDeps();
  const at = await now();
  const { aba } = await searchParams;
  const tab = aba === 'anteriores' ? 'past' : 'upcoming';
  const tz = (await deps.db.selectFrom('teachers').select('timezone').where('id', '=', teacherId).executeTakeFirstOrThrow()).timezone;
  const { upcoming, past } = splitLessons(await teacherLessons(deps.db, teacherId, at, PAST_DAYS), at);
  const lessons = tab === 'past' ? past : upcoming;
  const tabs = [
    { key: 'upcoming', label: 'Próximas', href: '/professor/aulas', count: upcoming.length },
    { key: 'past', label: 'Anteriores', href: '/professor/aulas?aba=anteriores', count: past.length },
  ] as const;

  return (
    <div className="space-y-6">
      <h1 className="font-display tracking-tight text-3xl font-normal">Aulas</h1>
      <nav aria-label="Aulas" className="flex gap-2 border-b border-site-line">
        {tabs.map((t) => (
          <Link key={t.key} href={t.href} aria-current={tab === t.key ? 'page' : undefined}
            className={`-mb-px flex min-h-11 items-center gap-2 border-b-2 px-3 font-medium ${tab === t.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-site-muted hover:text-slate-900'}`}>
            {t.label}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tab === t.key ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>{t.count}</span>
          </Link>
        ))}
      </nav>

      {lessons.length === 0 && (
        <p className={`${CARD} text-site-muted`}>
          {tab === 'past'
            ? `Nenhuma aula nos últimos ${PAST_DAYS} dias.`
            : 'Nenhuma aula marcada por enquanto. Quando um aluno reservar e pagar, a aula aparece aqui.'}
        </p>
      )}
      <ul className="space-y-3">
        {lessons.map((l) => (
          <li key={l.bookingId} className={`${CARD} space-y-2`} data-testid={`aula-${l.bookingId}`}>
            <p className="font-display tracking-tight text-lg font-normal">{formatPtBr(l.startsAt, tz)}</p>
            <p className="font-medium">{l.subject} · {l.studentFirstName}{l.studentGrade && ` (${l.studentGrade})`}</p>
            <p className="text-sm text-site-muted">{MODALITY[l.modality]} · <span data-testid="situacao">{STATUS[l.status] ?? l.status}</span>
              {l.checkedIn && ' · presença registrada'}</p>
            {l.address && <p className="text-sm">Endereço: {l.address}</p>}
            {l.refunded && <p className="text-sm text-site-muted" data-testid="devolvida">Valor devolvido ao aluno (falta justificada).</p>}
            {l.refundableUntil && l.refundCents !== null && (
              <details className="text-sm">
                <summary className="cursor-pointer text-brand">O aluno justificou a falta?</summary>
                <div className="mt-2 space-y-2">
                  <p>
                    Você pode devolver {formatBRL(l.refundCents)} ao responsável até {formatPtBr(l.refundableUntil, tz)}.
                    Se devolver, você não recebe por esta aula.
                  </p>
                  <ActionForm action={refundNoShowAction} submitLabel="Devolver ao aluno" className="space-y-2">
                    <input type="hidden" name="bookingId" value={l.bookingId} />
                    <label className="flex items-start gap-2">
                      <input type="checkbox" name="confirm" required className="mt-1" />
                      <span>Confirmo a devolução do valor desta aula ao responsável.</span>
                    </label>
                  </ActionForm>
                </div>
              </details>
            )}
            {l.status === 'confirmed' && l.modality === 'online' && (
              <ActionForm action={joinRoomAction} submitLabel="Entrar na sala" className="">
                <input type="hidden" name="bookingId" value={l.bookingId} />
              </ActionForm>
            )}
            {tab === 'upcoming' && l.startsAt.epochMilliseconds > at.epochMilliseconds && (
              <details className="text-sm">
                <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-site-muted">Não vai poder dar esta aula?</summary>
                <div className="mt-2 space-y-2">
                  <p>Se cancelar, a família recebe o valor integral de volta e é avisada na hora. Cancelamentos repetidos podem tirar seu perfil da busca.</p>
                  <ActionForm action={cancelLessonByTeacherAction} submitLabel="Cancelar a aula" successMessage="Aula cancelada. A família foi avisada." className="space-y-2" buttonClassName="btn-secondary">
                    <input type="hidden" name="bookingId" value={l.bookingId} />
                    <label className="flex items-start gap-2">
                      <input type="checkbox" name="confirm" required className="mt-1" />
                      <span>Confirmo que não vou dar esta aula.</span>
                    </label>
                  </ActionForm>
                </div>
              </details>
            )}
            {l.status === 'confirmed' && l.modality !== 'online' && !l.checkedIn && (
              <ActionForm action={checkinAction} submitLabel="Registrar chegada" successMessage="Presença registrada." className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="bookingId" value={l.bookingId} />
                <input name="code" className="input w-40 tracking-widest" inputMode="numeric" maxLength={6}
                  placeholder="Código da aula" aria-label="Código da aula informado pelo aluno" />
              </ActionForm>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
