import Link from 'next/link';
import { ConversationList } from '@/components/ConversationList';
import { conversations } from '@/domain/messages';
import { appDeps } from '@/server/app';
import { requireTeacher } from '@/server/session';

export const dynamic = 'force-dynamic';

/** Conversas do professor com as famílias, a mais recente primeiro. */
export default async function TeacherMessages() {
  const teacherId = await requireTeacher();
  const { db } = appDeps();
  const t = await db.selectFrom('teachers').select('timezone').where('id', '=', teacherId).executeTakeFirstOrThrow();
  const list = await conversations(db, { kind: 'teacher', id: teacherId });
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl font-bold">Mensagens</h1>
        <p className="text-site-muted">As famílias escrevem pelo seu perfil, antes ou depois de reservar. Telefone, e-mail e redes sociais ficam ocultos.</p>
      </div>
      {list.length === 0 ? (
        <div className="space-y-3 rounded-3xl border border-site-line bg-white p-5">
          <p className="text-site-muted">Nenhuma conversa ainda. Quando uma família escrever, a mensagem aparece aqui e avisamos você por e-mail.</p>
          <Link href="/professor" className="inline-flex min-h-11 items-center rounded-xl border border-site-field px-4 text-sm font-semibold">Divulgar minha página</Link>
        </div>
      ) : (
        <ConversationList items={list} hrefFor={(c) => `/professor/mensagens/${c.guardianId}`} tz={t.timezone} />
      )}
    </div>
  );
}
