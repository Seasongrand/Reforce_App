/** Lista de conversas (família ou professor): o outro lado, a última mensagem, quando e as não lidas. */
import Link from 'next/link';
import type { Conversation } from '@/domain/messages';

export function ConversationList({ items, hrefFor, tz }: { items: Conversation[]; hrefFor: (c: Conversation) => string; tz: string }) {
  const when = new Intl.DateTimeFormat('pt-BR', { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return (
    <ul className="divide-y divide-site-line rounded-3xl border border-site-line bg-white">
      {items.map((c) => (
        <li key={`${c.teacherId}:${c.guardianId}`}>
          <Link href={hrefFor(c)} className="flex min-h-16 items-center gap-3 px-5 py-3.5 hover:bg-violet-50/60">
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <strong className={c.unread ? 'font-bold' : 'font-semibold'}>{c.name}</strong>
                <span className="shrink-0 text-xs text-site-muted">{when.format(new Date(c.lastAt.epochMilliseconds))}</span>
              </span>
              <span className={`block truncate text-sm ${c.unread ? 'font-semibold text-indigo-950' : 'text-site-muted'}`}>
                {c.lastFromMe ? 'Você: ' : ''}{c.lastBody}
              </span>
            </span>
            {c.unread > 0 && (
              <span className="min-w-6 rounded-full bg-rose-600 px-2 text-center text-xs font-bold leading-6 text-white">
                {c.unread}<span className="sr-only"> {c.unread === 1 ? 'não lida' : 'não lidas'}</span>
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
