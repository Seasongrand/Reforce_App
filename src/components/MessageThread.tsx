'use client';

/**
 * Uma conversa (família ou professor): as mensagens, da mais antiga à mais
 * nova, e o campo de resposta. Atualiza sozinha a cada 15 segundos enquanto a
 * página está visível, e avisa quando um contato foi ocultado.
 */
import { startTransition, useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionState } from '@/server/action-result';

export interface ThreadItem { id: string; mine: boolean; body: string; at: string; hidden: boolean }

const REFRESH_MS = 15_000;

export function MessageThread({ messages, otherName, tz, hiddenFields, action, emptyHint }: {
  messages: ThreadItem[];
  otherName: string;
  tz: string;
  hiddenFields: Record<string, string>;
  action: (prev: unknown, f: FormData) => Promise<ActionState<{ hidden: boolean }>>;
  emptyHint: string;
}) {
  const router = useRouter();
  const [state, run, pending] = useActionState(action, null);
  const form = useRef<HTMLFormElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const when = new Intl.DateTimeFormat('pt-BR', { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  useEffect(() => { if (state?.ok) form.current?.reset(); }, [state]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="space-y-4">
      <div className="max-h-[60vh] min-h-48 space-y-3 overflow-y-auto rounded-[20px] border border-site-line bg-white p-4" data-testid="conversa" aria-live="polite">
        {messages.length === 0 && <p className="text-sm text-site-muted">{emptyHint}</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-[20px] px-3.5 py-2.5 ${m.mine ? 'rounded-br-md bg-indigo-600 text-white' : 'rounded-bl-md bg-violet-50 text-indigo-950'}`}>
              <p className="sr-only">{m.mine ? 'Você' : otherName}:</p>
              <p className="whitespace-pre-line text-[15px] leading-relaxed [overflow-wrap:anywhere]">{m.body}</p>
              <p className={`mt-1 text-right text-xs ${m.mine ? 'text-indigo-100' : 'text-site-muted'}`}>{when.format(new Date(m.at))}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>

      <form ref={form} className="space-y-2.5" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        startTransition(() => run(f));
      }}>
        {Object.entries(hiddenFields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <label htmlFor="mensagem" className="text-sm font-medium">Sua mensagem</label>
        <textarea id="mensagem" name="body" required maxLength={2000} rows={3}
          className="block w-full rounded-[20px] border border-site-field bg-white px-3.5 py-3 text-[15px] focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/30" />
        {state && !state.ok && <p className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{state.error}</p>}
        {state?.ok && state.data.hidden && (
          <p className="rounded-[20px] bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
            Ocultamos um contato da sua mensagem. Telefone, e-mail e redes sociais ficam fora da conversa, para proteger o aluno e a família.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-site-muted">Combine tudo por aqui: telefone, e-mail e redes sociais ficam ocultos.</p>
          <button className="inline-flex min-h-11 items-center rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60" disabled={pending}>
            {pending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </form>
    </div>
  );
}
