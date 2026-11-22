import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MessageThread } from '@/components/MessageThread';
import { openThread, shortName } from '@/domain/messages';
import { appDeps, now } from '@/server/app';
import { requireTeacher } from '@/server/session';
import { sendToGuardianAction } from '../actions';

export const dynamic = 'force-dynamic';

/** Conversa do professor com uma família. */
export default async function TeacherThread({ params }: { params: Promise<{ guardian: string }> }) {
  const teacherId = await requireTeacher();
  const { guardian } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(guardian)) notFound();
  const { db } = appDeps();
  const messages = await openThread(db, { teacherId, guardianId: guardian }, 'teacher', await now());
  if (!messages) notFound();
  const g = await db.selectFrom('guardians').select('name').where('id', '=', guardian).executeTakeFirstOrThrow();
  const t = await db.selectFrom('teachers').select('timezone').where('id', '=', teacherId).executeTakeFirstOrThrow();
  const name = shortName(g.name);
  return (
    <div className="space-y-5">
      <Link href="/professor/mensagens" className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-600">← Mensagens</Link>
      <h1 className="font-display tracking-tight text-3xl font-normal">{name}</h1>
      <MessageThread
        messages={messages.map((m) => ({ id: m.id, mine: m.sender === 'teacher', body: m.body, at: m.at.toString(), hidden: m.hidden }))}
        otherName={name} tz={t.timezone} hiddenFields={{ guardianId: guardian }} action={sendToGuardianAction}
        emptyHint="Nenhuma mensagem ainda." />
    </div>
  );
}
