'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Cronômetro da reserva temporária; ao zerar, recarrega a página. */
export function Countdown({ until }: { until: string }) {
  const router = useRouter();
  const end = new Date(until).getTime();
  const [left, setLeft] = useState<number | null>(null); // calculado só no navegador
  useEffect(() => {
    setLeft(end - Date.now());
    const t = setInterval(() => {
      const l = end - Date.now();
      setLeft(l);
      if (l <= 0) {
        clearInterval(t);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [end, router]);
  if (left === null) return <p className="notice" data-testid="cronometro">Horário reservado para você.</p>;
  if (left <= 0) return <p className="error">O tempo para pagar acabou.</p>;
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <p className="notice" data-testid="cronometro">
      Horário reservado para você por <strong>{m}:{String(s).padStart(2, '0')}</strong>.
    </p>
  );
}
