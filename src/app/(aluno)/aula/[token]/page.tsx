import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { RoomCountdown } from '@/components/aluno/RoomCountdown';
import { TITLE } from '@/components/aluno/ui';
import { lessonPageView } from '@/domain/lessons/page';
import { bothTimes, formatTime } from '@/time/zoned';
import { appDeps, now } from '@/server/app';
import { joinAsStudentAction } from './actions';

export const dynamic = 'force-dynamic';

const ROOM_OPENS_MIN = 10;

export default async function LessonPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const v = await lessonPageView(appDeps(), token, await now());
  if (!v) notFound();
  const active = v.status === 'confirmed';
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h1 className={TITLE}>Aula de {v.subject}</h1>
        <p className="text-[15px] text-site-muted">
          {bothTimes(v.startsAt, v.teacherTimezone, v.guardianTimezone)} às {formatTime(v.endsAt, v.guardianTimezone)} ·{' '}
          {v.studentFirstName} com {v.teacherName}
        </p>
      </div>

      {!active && <p className="notice">Esta aula não está mais ativa.</p>}

      {active && v.modality === 'online' && (
        <>
          <div className="flex flex-col items-center gap-3.5 rounded-2xl bg-indigo-950 px-5 py-6 text-center text-white">
            {v.roomOpen ? (
              <>
                <p className="text-[15px] text-site-on-dark">A sala está aberta.</p>
                <ActionForm action={joinAsStudentAction} submitLabel="Entrar na aula" className="w-full space-y-3"
                  buttonClassName="min-h-14 w-full rounded-2xl bg-yellow-400 text-[17px] font-semibold text-indigo-950 hover:bg-yellow-300 disabled:opacity-60">
                  <input type="hidden" name="token" value={token} />
                </ActionForm>
              </>
            ) : (
              <>
                <p className="text-[15px] text-site-on-dark">A sala abre em</p>
                <p className="font-display text-5xl font-bold leading-none">
                  <RoomCountdown opensAt={v.startsAt.subtract({ minutes: ROOM_OPENS_MIN }).toString()} />
                </p>
                <button type="button" disabled className="min-h-14 w-full rounded-2xl bg-[#4c478f] text-[17px] font-semibold text-site-on-dark">
                  Entrar na aula
                </button>
                <p className="text-[13px] text-site-on-dark">O botão é liberado 10 minutos antes da aula.</p>
              </>
            )}
          </div>
          <ul className="space-y-2.5 text-sm leading-normal text-[#3b3870]">
            <li>✓ Funciona no navegador do computador ou do celular.</li>
            <li>✓ Permita o uso da câmera e do microfone quando o navegador pedir.</li>
            <li>✓ Só entram o professor e o aluno desta aula.</li>
          </ul>
        </>
      )}

      {active && v.modality !== 'online' && (
        <div className="space-y-3 rounded-2xl border border-site-line p-5">
          {v.address && <p className="text-[15px]">Endereço: <strong>{v.address}</strong></p>}
          <p className="text-sm text-site-muted">Código da aula, para dizer ao professor na chegada:</p>
          <p className="font-display text-4xl font-bold tracking-[0.3em]" data-testid="codigo">{v.checkinCode}</p>
        </div>
      )}
    </div>
  );
}
