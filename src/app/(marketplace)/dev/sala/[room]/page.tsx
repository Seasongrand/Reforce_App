import { notFound } from 'next/navigation';
import { Temporal } from 'temporal-polyfill';
import { devToolsEnabled } from '@/domain/dev';
import { FakeVideoProvider } from '@/providers/video/fake';
import { appDeps, now } from '@/server/app';

export const dynamic = 'force-dynamic';

/** Sala de vídeo falsa: no lugar do vídeo, botões que avisam entrada e saída. */
export default async function FakeRoom({
  params, searchParams,
}: { params: Promise<{ room: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const deps = appDeps();
  if (!devToolsEnabled(deps.config) || !(deps.providers.video instanceof FakeVideoProvider)) notFound();
  const room = decodeURIComponent((await params).room);
  const q = await searchParams;
  const role = q.role ?? '';
  const until = q.until ?? '';
  const valid = q.token === deps.providers.video.accessToken(room, role, until)
    && until !== '' && Temporal.Instant.compare(Temporal.Instant.from(until), await now()) >= 0;
  if (!valid) return <p className="error">Acesso à sala inválido ou vencido.</p>;
  const ls = await deps.db.selectFrom('lesson_sessions').select(['teacher_joined_at', 'student_joined_at'])
    .where('video_room', '=', room).executeTakeFirst();
  const here = role === 'teacher' ? ls?.teacher_joined_at : ls?.student_joined_at;
  const back = `/dev/sala/${encodeURIComponent(room)}?${new URLSearchParams(q as Record<string, string>)}`;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium">Sala de aula (simulada)</h1>
      <p className="text-sm">Você: <strong>{q.name}</strong> ({role === 'teacher' ? 'professor' : 'aluno'})</p>
      <p className="text-sm" data-testid="presenca">{here ? 'Presença registrada na sala.' : 'Ainda fora da sala.'}</p>
      <div className="flex gap-2">
        {(['joined', 'left'] as const).map((kind) => (
          <form key={kind} action="/api/dev/presenca" method="post">
            <input type="hidden" name="room" value={room} />
            <input type="hidden" name="role" value={role} />
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="voltar" value={back} />
            <button className={kind === 'joined' ? 'btn' : 'btn-secondary'}>{kind === 'joined' ? 'Entrar' : 'Sair'}</button>
          </form>
        ))}
      </div>
    </div>
  );
}
