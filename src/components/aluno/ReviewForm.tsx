'use client';

/** Nota de 1 a 5 em estrelas grandes (rádios de verdade) e comentário opcional. */
import { useActionState, useState } from 'react';
import type { ActionState } from '@/server/action-result';
import { ALERT, INPUT, LABEL, PRIMARY } from './ui';

const LABELS = ['', 'Ruim', 'Fraca', 'Boa', 'Muito boa', 'Excelente'];

export function ReviewForm({ bookingId, action }: { bookingId: string; action: (p: unknown, f: FormData) => Promise<ActionState> }) {
  const [state, run, pending] = useActionState(action, null);
  const [rating, setRating] = useState(0);
  return (
    <form action={run} className="space-y-5">
      <input type="hidden" name="bookingId" value={bookingId} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Sua nota</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="rating" value={n} required className="peer sr-only" aria-label={`${n} — ${LABELS[n]}`}
                onChange={() => setRating(n)} />
              <span aria-hidden="true"
                className={`flex size-13 items-center justify-center rounded-xl text-4xl peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-600 ${n <= rating ? 'text-yellow-400' : 'text-site-line'}`}>
                ★
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1 min-h-5 text-sm font-medium text-site-muted">{LABELS[rating]}</p>
      </fieldset>
      <label className={LABEL}>Conte como foi (opcional)
        <textarea name="comment" rows={4} maxLength={1000} className={`${INPUT} py-3`} />
        <span className="text-[13px] font-normal text-site-muted">
          Aparece no perfil do professor com o seu primeiro nome e a inicial do sobrenome. O nome do aluno não aparece.
        </span>
      </label>
      {state && !state.ok && <p className={ALERT} role="alert">{state.error}</p>}
      <button className={PRIMARY} disabled={pending}>{pending ? 'Enviando…' : 'Enviar avaliação'}</button>
    </form>
  );
}
