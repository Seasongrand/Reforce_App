import type { Metadata } from 'next';
import Link from 'next/link';
import { ConversationList } from '@/components/ConversationList';
import { conversations } from '@/domain/messages';
import { appDeps } from '@/server/app';
import { requireGuardian } from '@/server/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Mensagens · Minha conta · Reforce' };

/** Conversas da família com os professores, a mais recente primeiro. */
export default async function GuardianMessages() {
  const guardianId = await requireGuardian();
  const { db } = appDeps();
  const g = await db.selectFrom('guardians').select('timezone').where('id', '=', guardianId).executeTakeFirstOrThrow();
  const list = await conversations(db, { kind: 'guardian', id: guardianId });
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl font-bold">Mensagens</h1>
        <p className="text-site-muted">Converse com os professores antes e depois de reservar. Telefone, e-mail e redes sociais ficam ocultos.</p>
      </div>
      {list.length === 0 ? (
        <div className="space-y-3 rounded-3xl border border-site-line bg-white p-5">
          <p className="text-site-muted">Nenhuma conversa ainda. No perfil de um professor, toque em “Mandar mensagem”.</p>
          <Link href="/buscar" className="inline-flex min-h-11 items-center rounded-xl border border-site-field px-4 text-sm font-semibold">Buscar professor</Link>
        </div>
      ) : (
        <ConversationList items={list} hrefFor={(c) => `/conta/mensagens/${c.teacherSlug}`} tz={g.timezone ?? 'America/Sao_Paulo'} />
      )}
    </div>
  );
}
