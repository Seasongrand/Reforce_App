import { handlePaymentWebhook } from '@/domain/payment/webhook';
import { FakePaymentProvider } from '@/providers/payment/fake';
import { appDeps, now } from '@/server/app';

export const dynamic = 'force-dynamic';

/** Só em desenvolvimento: simula o provedor avisando que a cobrança foi paga. */
export async function POST(req: Request) {
  const deps = appDeps();
  if (!deps.config.devTools || !(deps.providers.payment instanceof FakePaymentProvider)) {
    return new Response('não encontrado', { status: 404 });
  }
  const form = await req.formData();
  const chargeId = String(form.get('chargeId') ?? '');
  const back = String(form.get('voltar') ?? '/');
  const { headers, body } = deps.providers.payment.simulateEvent(chargeId, 'payment.paid');
  await handlePaymentWebhook(deps, headers, body, await now());
  return Response.redirect(new URL(back.startsWith('/') ? back : '/', req.url), 303);
}
