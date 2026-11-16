import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { lessonPageView } from '@/domain/lessons/page';
import { bothTimes } from '@/time/zoned';
import { appDeps, now } from '@/server/app';
import { joinAsStudentAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function LessonPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const v = await lessonPageView(appDeps(), token, await now());
  if (!v) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Aula de {v.subject}</h1>
      <div className="card space-y-1 text-sm">
        <p>{v.studentFirstName} com {v.teacherName}</p>
        <p className="font-medium">{bothTimes(v.startsAt, v.teacherTimezone, v.guardianTimezone)}</p>
      </div>
      {v.status !== 'confirmed' && <p className="notice">Esta aula não está mais ativa.</p>}
      {v.status === 'confirmed' && v.modality === 'online' && (v.roomOpen ? (
        <ActionForm action={joinAsStudentAction} submitLabel="Entrar na aula" className="card">
          <input type="hidden" name="token" value={token} />
        </ActionForm>
      ) : <p className="notice">A sala abre 10 minutos antes da aula. Volte a esta página perto do horário.</p>)}
      {v.status === 'confirmed' && v.modality !== 'online' && (
        <div className="card space-y-2 text-sm">
          {v.address && <p>Endereço: <strong>{v.address}</strong></p>}
          <p>Código da aula, para informar ao professor na chegada:</p>
          <p className="text-2xl font-semibold tracking-widest" data-testid="codigo">{v.checkinCode}</p>
        </div>
      )}
    </div>
  );
}
