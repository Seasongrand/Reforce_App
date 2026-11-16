/**
 * Entrega de um documento de verificação: exige sessão da equipe E link
 * assinado ainda válido. Nunca vai para cache.
 */
import type { Temporal } from 'temporal-polyfill';
import type { Deps } from '../deps';

export async function serveVerificationFile(
  deps: Deps,
  input: { staffId: string | null; key: string; exp: string; sig: string },
  now: Temporal.Instant,
): Promise<Response> {
  const denied = () => new Response('acesso negado', { status: 403, headers: { 'cache-control': 'no-store' } });
  if (!input.staffId) return denied();
  if (!input.key.startsWith('verificacoes/')) return denied();
  if (!deps.providers.storage.verifySignature(input.key, input.exp, input.sig, now)) return denied();
  try {
    const f = await deps.providers.storage.get(input.key);
    return new Response(Buffer.from(f.bytes), {
      status: 200,
      headers: {
        'content-type': f.contentType,
        'content-disposition': 'inline',
        'cache-control': 'no-store, private',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch {
    return new Response('não encontrado', { status: 404, headers: { 'cache-control': 'no-store' } });
  }
}
