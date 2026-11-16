import { handlePaymentWebhook } from '@/domain/payment/webhook';
import { WebhookSignatureError } from '@/providers/errors';
import { appDeps, now } from '@/server/app';

export const dynamic = 'force-dynamic';

/** Notificação do provedor de pagamento: gravada primeiro, efeito uma vez só (§2.4). */
export async function POST(req: Request) {
  const body = await req.text();
  try {
    const r = await handlePaymentWebhook(appDeps(), req.headers, body, await now());
    return Response.json(r);
  } catch (err) {
    if (err instanceof WebhookSignatureError) return new Response('assinatura inválida', { status: 401 });
    console.error('[webhook pagamento]', err);
    return new Response('erro', { status: 500 }); // o provedor tenta de novo
  }
}
