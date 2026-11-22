'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Faixa amarela com o tempo em que o horário fica guardado; ao zerar, recarrega
 * a página. Conta a partir dos segundos restantes calculados no servidor, e não
 * do horário final: um celular com o relógio errado mostra o tempo certo.
 */
export function Countdown({ secondsLeft }: { secondsLeft: number }) {
  const router = useRouter();
  const [left, setLeft] = useState<number | null>(null); // calculado só no navegador
  useEffect(() => {
    const end = Date.now() + secondsLeft * 1000;
    const tick = () => {
      const l = end - Date.now();
      setLeft(l);
      if (l <= 0) {
        clearInterval(t);
        router.refresh();
      }
    };
    const t = setInterval(tick, 1000);
    tick();
    return () => clearInterval(t);
  }, [secondsLeft, router]);
  // fica logo abaixo do topo fixo (64 px no celular, 72 px no computador)
  const bar = 'sticky top-16 z-10 -mx-5 flex items-center gap-2.5 rounded-b-lg border-b border-indigo-950/10 bg-[#f1effd] px-5 py-3 text-[15px] font-medium text-indigo-950 lg:top-[72px]';
  const icon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2" />
      <path d="M9 2h6" />
    </svg>
  );
  if (left === null) return <p className={bar} data-testid="cronometro">{icon}Horário guardado para você.</p>;
  if (left <= 0) return <p className={bar} role="alert">{icon}O tempo para pagar acabou.</p>;
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <p className={bar} data-testid="cronometro" role="timer">
      {icon}Horário guardado para você por <span className="font-display tracking-tight text-lg">{m}:{String(s).padStart(2, '0')}</span>
    </p>
  );
}
