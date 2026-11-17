'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Tempo até a sala abrir (10 minutos antes da aula); ao zerar, recarrega a página, que mostra o botão de entrar. */
export function RoomCountdown({ opensAt }: { opensAt: string }) {
  const router = useRouter();
  const target = new Date(opensAt).getTime();
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    setLeft(target - Date.now());
    const t = setInterval(() => {
      const l = target - Date.now();
      setLeft(l);
      if (l <= 0) {
        clearInterval(t);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [target, router]);
  if (left === null) return <span>em breve</span>;
  if (left <= 0) return <span>agora</span>;
  const min = Math.ceil(left / 60000);
  if (min < 60) return <span>{min} min</span>;
  const h = Math.floor(min / 60);
  if (h < 48) return <span>{h} h {String(min % 60).padStart(2, '0')} min</span>;
  return <span>{Math.floor(h / 24)} dias</span>;
}
