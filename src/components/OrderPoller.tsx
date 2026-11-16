'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Consulta o estado do pedido a cada 3 segundos e recarrega quando muda. */
export function OrderPoller({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(async () => {
      const r = await fetch(`/api/pedido/${orderId}/estado`, { cache: 'no-store' });
      if (!r.ok) return;
      const body = (await r.json()) as { status: string };
      if (body.status !== status) router.refresh();
    }, 3000);
    return () => clearInterval(t);
  }, [orderId, status, router]);
  return null;
}
