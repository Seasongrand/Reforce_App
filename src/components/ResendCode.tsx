'use client';

/**
 * "Reenviar código" (liberado 60 s depois de cada envio) e "Usar outro
 * e-mail", com o lembrete do spam. A contagem usa o horário de cada envio, e
 * não o número de segundos passados: continua certa com a aba em segundo plano.
 */
import { useEffect, useState } from 'react';

export const RESEND_SECONDS = 60;

function useCooldown(key: string): number {
  const [left, setLeft] = useState(RESEND_SECONDS);
  useEffect(() => {
    const until = Date.now() + RESEND_SECONDS * 1000;
    const tick = () => setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [key]);
  return left;
}

const LINK = 'inline-flex min-h-11 items-center font-semibold text-indigo-600 disabled:font-medium disabled:text-site-muted';

export function ResendCode({ codeId, sending, onResend, onOtherEmail }: {
  codeId: string; sending: boolean; onResend: () => void; onOtherEmail: () => void;
}) {
  const left = useCooldown(codeId);
  const wait = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  return (
    <div className="space-y-1">
      <p className="text-sm text-site-muted">Não chegou? Confira também a caixa de spam.</p>
      <div className="flex flex-wrap gap-x-5">
        <button type="button" className={LINK} onClick={onResend} disabled={sending || left > 0}>
          {sending ? 'Reenviando…' : left > 0 ? `Reenviar código em ${wait}` : 'Reenviar código'}
        </button>
        <button type="button" className={LINK} onClick={onOtherEmail}>Usar outro e-mail</button>
      </div>
    </div>
  );
}
