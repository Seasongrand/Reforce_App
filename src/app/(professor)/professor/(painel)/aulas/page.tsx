import { ActionForm } from '@/components/ActionForm';
import { teacherLessons } from '@/domain/teachers/lessons';
import { formatBRL } from '@/lib/money';
import { formatPtBr } from '@/time/zoned';
import { appDeps, now } from '@/server/app';
import { requireTeacher } from '@/server/session';
import { checkinAction, joinRoomAction, refundNoShowAction } from './actions';

export const dynamic = 'force-dynamic';

const MODALITY: Record<string, string> = { online: 'Online', at_teacher: 'No seu endereço', at_student: 'Na casa do aluno' };
const STATUS: Record<string, string> = {
  confirmed: 'Confirmada', completed: 'Concluída', no_show: 'Aluno faltou', cancelled: 'Cancelada',
};

export default async function TeacherLessonsPage() {
  const teacherId = await requireTeacher();
  const deps = appDeps();
  const at = await now();
  const tz = (await deps.db.selectFrom('teachers').select('timezone').where('id', '=', teacherId).executeTakeFirstOrThrow()).timezone;
  const lessons = await teacherLessons(deps.db, teacherId, at);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Aulas</h1>
      {lessons.length === 0 && <p className="text-slate-600">Nenhuma aula paga ainda.</p>}
      <ul className="space-y-3">
        {lessons.map((l) => (
          <li key={l.bookingId} className="card space-y-2" data-testid={`aula-${l.bookingId}`}>
            <p className="font-medium">{formatPtBr(l.startsAt, tz)} · {l.subject} · {l.studentFirstName}
              {l.studentGrade && ` (${l.studentGrade})`}</p>
            <p className="text-sm text-slate-600">{MODALITY[l.modality]} · <span data-testid="situacao">{STATUS[l.status] ?? l.status}</span>
              {l.checkedIn && ' · presença registrada'}</p>
            {l.address && <p className="text-sm">Endereço: {l.address}</p>}
            {l.refunded && <p className="text-sm text-slate-600" data-testid="devolvida">Valor devolvido ao aluno (falta justificada).</p>}
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
