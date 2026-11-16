'use client';

import { useActionState } from 'react';
import type { ActionState } from '@/server/action-result';

/** Formulário com ação do servidor, mensagem de erro e de sucesso. */
export function ActionForm({
  action,
  children,
  submitLabel,
  successMessage,
  className,
}: {
  action: (prev: unknown, form: FormData) => Promise<ActionState<unknown>>;
  children: React.ReactNode;
  submitLabel: string;
  successMessage?: string;
  className?: string;
}) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className={className ?? 'card space-y-4'}>
      {children}
      {state && !state.ok && <p className="error" role="alert">{state.error}</p>}
      {state?.ok && successMessage && <p className="notice" role="status">{successMessage}</p>}
      <button className="btn" disabled={pending}>{pending ? 'Salvando…' : submitLabel}</button>
    </form>
  );
}
