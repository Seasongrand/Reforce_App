import { ActionForm } from '@/components/ActionForm';
import { openDisputes } from '@/domain/lessons/dispute';
import { formatBRL } from '@/lib/money';
import { formatPtBr } from '@/time/zoned';
import { appDeps } from '@/server/app';
import { requireStaff } from '@/server/session';
import { resolveDisputeAction } from '../../actions';

export const dynamic = 'force-dynamic';

const CARD = 'space-y-4 rounded-[20px] border border-site-line bg-white p-5';
const SP = 'America/Sao_Paulo';
const MODALITY: Record<string, string> = { online: 'online', at_student: 'na casa do aluno', at_teacher: 'no endereço do professor' };
const OUTCOME: Record<string, string> = {
  taught: 'aula dada', student_no_show: 'falta do aluno', teacher_no_show: 'falta do professor', interrupted: 'interrompida',
};
const minutes = (s: number) => `${Math.round(s / 60)} min`;
const BTN = 'inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-medium disabled:opacity-50';

/** Contestações abertas pelas famílias: a evidência da aula e a decisão (libera ao professor ou devolve à família). */
export default async function StaffDisputes() {
  await requireStaff();
  const list = await openDisputes(appDeps().db);
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-display tracking-tight text-3xl font-normal">Contestações</h1>
        <p className="text-site-muted">
          O repasse de cada aula contestada fica retido até a decisão. O motivo que você escrever vai para a família e para o professor.
        </p>
      </div>
      {list.length === 0 ? (
        <p className={`${CARD} text-site-muted`}>Nenhuma contestação aberta.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((d) => (
            <li key={d.id} className={CARD} data-testid="contestacao">
              <div className="space-y-1">
                <p className="font-medium">{d.subject} · {d.teacherName} com {d.studentFirstName} ({d.guardianName})</p>
                <p className="text-sm text-site-muted">
                  {formatPtBr(d.startsAt, SP)} · {MODALITY[d.modality]} · {formatBRL(d.amountCents)} · contestada em {formatPtBr(d.openedAt, SP)}
                </p>
              </div>
              <p className="border-l-2 border-indigo-200 pl-3 text-[15px]">{d.reason}</p>
              <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                <div><dt className="text-site-muted">Registro da aula</dt><dd>{d.outcome ? OUTCOME[d.outcome] ?? d.outcome : 'sem registro'}</dd></div>
                {d.modality === 'online' ? (
                  <>
                    <div><dt className="text-site-muted">Professor na sala</dt><dd>{minutes(d.evidence.teacherSeconds)}</dd></div>
                    <div><dt className="text-site-muted">Aluno na sala</dt><dd>{minutes(d.evidence.studentSeconds)}</dd></div>
                  </>
                ) : (
                  <div><dt className="text-site-muted">Código da aula</dt><dd>{d.evidence.checkedIn ? 'digitado pelo professor' : 'não digitado'}</dd></div>
                )}
              </dl>
              <ActionForm action={resolveDisputeAction} submitLabel="Decidir" className="space-y-3"
                buttonClassName={`${BTN} bg-indigo-600 text-white hover:bg-indigo-700`}>
                <input type="hidden" name="disputeId" value={d.id} />
                <fieldset className="flex flex-wrap gap-2">
                  <legend className="sr-only">Decisão</legend>
                  <label className="flex min-h-11 items-center gap-2 rounded-lg border border-site-line px-3 text-sm has-[:checked]:border-indigo-600 has-[:checked]:bg-violet-50">
                    <input type="radio" name="decision" value="for_teacher" required className="size-5 accent-indigo-600" />
                    Manter a aula (o valor vai para o professor)
                  </label>
                  <label className="flex min-h-11 items-center gap-2 rounded-lg border border-site-line px-3 text-sm has-[:checked]:border-indigo-600 has-[:checked]:bg-violet-50">
                    <input type="radio" name="decision" value="for_guardian" required className="size-5 accent-indigo-600" />
                    Devolver {formatBRL(d.amountCents)} à família
                  </label>
                </fieldset>
                <label className="block space-y-1.5 text-sm font-medium">
                  Motivo da decisão
                  <textarea name="note" required rows={2} maxLength={500}
                    className="block w-full rounded-lg border border-site-field bg-white px-3 py-2 text-[15px] font-normal focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/30" />
                </label>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
