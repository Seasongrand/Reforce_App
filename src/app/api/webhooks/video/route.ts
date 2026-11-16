import { handleVideoWebhook } from '@/domain/lessons/presence';
import { WebhookSignatureError } from '@/providers/errors';
import { appDeps, now } from '@/server/app';

export const dynamic = 'force-dynamic';

/** Presença na sala de vídeo (§2.6). */
export async function POST(req: Request) {
  const body = await req.text();
  try {
    return Response.json(await handleVideoWebhook(appDeps(), req.headers, body, await now()));
  } catch (err) {
    if (err instanceof WebhookSignatureError) return new Response('assinatura inválida', { status: 401 });
    console.error('[webhook vídeo]', err);
    return new Response('erro', { status: 500 });
  }
}
