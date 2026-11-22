import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MessageThread } from '@/components/MessageThread';
import { openThread } from '@/domain/messages';
import { appDeps, now } from '@/server/app';
import { requireGuardian } from '@/server/session';
import { sendToTeacherAction } from '../../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Conversa · Minha conta · Reforce' };

/** Conversa da família com um professor; a primeira mensagem pode ser antes de reservar. */
export default async function GuardianThread({ params }: { params: Promise<{ slug: string }> }) {
  const guardianId = await requireGuardian();
  const { slug } = await params;
  const { db } = appDeps();
  const t = await db.selectFrom('teachers').select(['id', 'display_name', 'status']).where('slug', '=', slug).executeTakeFirst();
  if (!t) notFound();
  const messages = (await openThread(db, { teacherId: t.id, guardianId }, 'guardian', await now())) ?? [];
  if (messages.length === 0 && t.status !== 'approved') notFound();
  const g = await db.selectFrom('guardians').select('timezone').where('id', '=', guardianId).executeTakeFirstOrThrow();
  return (
    <div className="space-y-5">
      <Link href="/conta/mensagens" className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-600">← Mensagens</Link>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display tracking-tight text-3xl font-normal">{t.display_name}</h1>
        <Link href={`/p/${slug}`} className="text-sm font-medium text-indigo-600 underline">Ver perfil e horários</Link>
      </div>
      <MessageThread
        messages={messages.map((m) => ({ id: m.id, mine: m.sender === 'guardian', body: m.body, at: m.at.toString(), hidden: m.hidden }))}
        otherName={t.display_name} tz={g.timezone ?? 'America/Sao_Paulo'}
        hiddenFields={{ teacherId: t.id }} action={sendToTeacherAction}
        emptyHint={`Escreva para ${t.display_name.split(/\s+/)[0]}: conte a série do aluno e o que ele precisa estudar.`} />
    </div>
  );
}
