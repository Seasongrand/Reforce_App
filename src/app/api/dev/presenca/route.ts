import { handleVideoWebhook } from '@/domain/lessons/presence';
import { devToolsEnabled } from '@/domain/dev';
import { FakeVideoProvider } from '@/providers/video/fake';
import { appDeps, now } from '@/server/app';

export const dynamic = 'force-dynamic';

/** Só em desenvolvimento: a sala falsa avisa entrada e saída como o provedor de vídeo faria. */
export async function POST(req: Request) {
  const deps = appDeps();
  if (!devToolsEnabled(deps.config) || !(deps.providers.video instanceof FakeVideoProvider)) {
    return new Response('não encontrado', { status: 404 });
  }
  const f = await req.formData();
  const room = String(f.get('room') ?? '');
  const role = String(f.get('role') ?? '') as 'teacher' | 'student' | 'observer';
  const kind = f.get('kind') === 'left' ? 'left' : 'joined';
  const { headers, body } = deps.providers.video.simulatePresence(room, role, kind, await now());
  await handleVideoWebhook(deps, headers, body, await now());
  const back = String(f.get('voltar') ?? '/');
  return Response.redirect(new URL(back.startsWith('/') ? back : '/', req.url), 303);
}
