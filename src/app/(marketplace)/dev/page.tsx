import { notFound } from 'next/navigation';
import { sql } from 'kysely';
import { ActionForm } from '@/components/ActionForm';
import { devToolsEnabled } from '@/domain/dev';
import { formatPtBr } from '@/time/zoned';
import { appDeps, now } from '@/server/app';
import { addBusyAction, advanceClockAction, resetClockAction, runSweepsAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function DevPage() {
  const deps = appDeps();
  if (!devToolsEnabled(deps.config)) notFound();
  const at = await now();
  const outbox = await sql<{ id: string; channel: string; recipient: string; template: string | null; subject: string | null; body: string; created_at: string }>`
    SELECT id::text, channel, recipient, template, subject, body, created_at FROM dev_outbox ORDER BY id DESC LIMIT 40`
    .execute(deps.db);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium">Ferramentas de desenvolvimento</h1>
      <p className="notice">Só existe com DEV_TOOLS=1 e adaptadores falsos. Nada aqui chega a pessoas reais.</p>

      <section className="card space-y-3">
        <h2 className="font-medium">Relógio</h2>
        <p className="text-sm">Agora (São Paulo): <strong data-testid="relogio">{formatPtBr(at, 'America/Sao_Paulo')}</strong> · <code className="text-xs">{at.toString()}</code></p>
        <div className="flex flex-wrap gap-2">
          {[[60, '+1 hora'], [24 * 60, '+1 dia'], [10, '+10 minutos']].map(([m, label]) => (
            <ActionForm key={label} action={advanceClockAction} submitLabel={String(label)} className="">
              <input type="hidden" name="minutes" value={m} />
            </ActionForm>
          ))}
          <ActionForm action={advanceClockAction} submitLabel="Avançar" className="flex gap-2">
            <input name="minutes" className="input w-28" inputMode="numeric" placeholder="minutos" aria-label="Minutos para avançar" />
          </ActionForm>
          <ActionForm action={resetClockAction} submitLabel="Voltar ao relógio real" className="" />
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="font-medium">Worker</h2>
        <p className="text-sm text-slate-600">Expira reservas, envia mensagens vencidas, fecha aulas, libera repasses, vence certidões e roda a fila.</p>
        <ActionForm action={runSweepsAction} submitLabel="Rodar varreduras agora" successMessage="Varreduras executadas." className="" />
      </section>

      <section className="card space-y-2">
        <h2 className="font-medium">Compromisso no calendário (simulado)</h2>
        <ActionForm action={addBusyAction} submitLabel="Adicionar compromisso" successMessage="Compromisso adicionado." className="grid gap-2 sm:grid-cols-4">
          <input name="slug" className="input" placeholder="endereço da página" aria-label="Página do professor" required />
          <input name="start" type="datetime-local" className="input" aria-label="Início (hora local do professor)" required />
          <input name="end" type="datetime-local" className="input" aria-label="Fim" required />
        </ActionForm>
      </section>

      <section className="card space-y-2">
        <h2 className="font-medium">Caixa de saída (WhatsApp e e-mail)</h2>
        <ul className="space-y-2 text-sm" data-testid="caixa-de-saida">
          {outbox.rows.map((m) => (
            <li key={m.id} className="rounded border border-slate-200 p-2" data-channel={m.channel} data-recipient={m.recipient}>
              <p className="text-xs text-slate-500">{m.channel} → {m.recipient} {m.template ? `· ${m.template}` : ''}</p>
              {m.subject && <p className="font-medium">{m.subject}</p>}
              <pre className="whitespace-pre-wrap font-sans">{m.body}</pre>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
