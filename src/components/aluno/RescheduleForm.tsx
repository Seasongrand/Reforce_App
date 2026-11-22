'use client';

/** Remarcar: o calendário do mês com os horários livres do mesmo tipo de aula e o botão de confirmar. */
import { startTransition, useActionState, useState } from 'react';
import type { ActionState } from '@/server/action-result';
import { MonthSlots } from './MonthSlots';
import { ALERT } from './ui';

export function RescheduleForm({ bookingId, slots, tz, action }: {
  bookingId: string; slots: string[]; tz: string;
  action: (prev: unknown, f: FormData) => Promise<ActionState>;
}) {
  const [slot, setSlot] = useState<string | null>(null);
  const [state, run, pending] = useActionState(action, null);
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      startTransition(() => run(f));
    }}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="startsAt" value={slot ?? ''} />
      <MonthSlots slots={slots} tz={tz} selected={slot} onPick={setSlot} empty="Sem outros horários livres nas próximas semanas." />
      {state && !state.ok && <p className={ALERT} role="alert">{state.error}</p>}
      <button disabled={!slot || pending}
        className="inline-flex min-h-12 items-center rounded-lg bg-indigo-600 px-5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        {pending ? 'Remarcando…' : 'Remarcar para este horário'}
      </button>
    </form>
  );
}
