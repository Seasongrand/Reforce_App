import { notFound } from 'next/navigation';
import { devToolsEnabled } from '@/domain/dev';
import { formatBRL } from '@/lib/money';
import { appDeps } from '@/server/app';

export const dynamic = 'force-dynamic';

/** Página de cartão falsa: no lugar do checkout do provedor, um botão que simula a aprovação. */
export default async function FakeCardCheckout({ params }: { params: Promise<{ charge: string }> }) {
  const deps = appDeps();
  if (!devToolsEnabled(deps.config)) notFound();
  const charge = (await params).charge;
  const p = await deps.db.selectFrom('payments').select(['order_id', 'amount_cents', 'status'])
    .where('provider_charge_id', '=', charge).executeTakeFirst();
  if (!p) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Cartão (simulado)</h1>
      <p>Valor: {formatBRL(p.amount_cents)} · situação: {p.status}</p>
      <form action="/api/dev/pagar" method="post">
        <input type="hidden" name="chargeId" value={charge} />
        <input type="hidden" name="voltar" value={`/pedido/${p.order_id}`} />
        <button className="btn">Aprovar pagamento</button>
      </form>
    </div>
  );
}
