'use client';

/**
 * Escolha da forma de pagamento (tela 4). Sem cobrança criada: dois cartões
 * grandes, PIX e cartão. Com cobrança: o botão para trocar de forma. Usa a
 * ação do servidor de sempre (startPaymentAction).
 */
import { useActionState } from 'react';
import type { ActionState } from '@/server/action-result';
import { ALERT, SECONDARY } from './ui';

type Action = (prev: unknown, f: FormData) => Promise<ActionState<unknown>>;

function MethodButton({ method, title, note, pending }: { method: 'pix' | 'card'; title: string; note: string; pending: boolean }) {
  return (
    <button name="method" value={method} disabled={pending} aria-label={method === 'pix' ? 'Pagar com PIX' : 'Pagar com cartão'}
      className="flex min-h-20 w-full flex-col items-start justify-center gap-1 rounded-[20px] border border-site-field bg-white px-5 text-left hover:border-indigo-600 hover:bg-indigo-50 disabled:opacity-60">
      <span className="text-[17px] font-medium">{title}</span>
      <span className="text-[13px] text-site-muted">{note}</span>
    </button>
  );
}

export function PayChoice({ orderId, action, switchFrom, askCpf = false }: { orderId: string; action: Action; switchFrom?: 'pix' | 'card'; askCpf?: boolean }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      {askCpf && (
        <label className="block space-y-1.5">
          <span className="text-[15px] font-medium">CPF de quem paga</span>
          <input name="payerCpf" required inputMode="numeric" autoComplete="off" maxLength={18} placeholder="000.000.000-00"
            className="block min-h-12 w-full rounded-lg border border-site-field bg-white px-3 text-[16px] focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/30" />
          <span className="block text-[13px] text-site-muted">O banco exige o CPF para emitir a cobrança. Ele vai direto para o provedor de pagamento, e a Reforce não guarda.</span>
        </label>
      )}
      {switchFrom ? (
        <button name="method" value={switchFrom === 'pix' ? 'card' : 'pix'} disabled={pending} className={SECONDARY}>
          {switchFrom === 'pix' ? 'Trocar para cartão' : 'Trocar para PIX'}
        </button>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <MethodButton method="pix" title="PIX" note="Aprovação na hora, pelo app do banco" pending={pending} />
          <MethodButton method="card" title="Cartão de crédito" note="Na página segura do provedor de pagamento" pending={pending} />
        </div>
      )}
      {state && !state.ok && <p className={ALERT} role="alert">{state.error}</p>}
    </form>
  );
}
