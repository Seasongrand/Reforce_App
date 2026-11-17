/**
 * Foto pública do professor: só fotos aprovadas. O endereço muda quando a
 * foto muda (o id é novo), então o cache pode ser longo. No modo lista de
 * espera, o proxy fecha esta rota como o resto do marketplace.
 */
import { publicPhotoBytes } from '@/domain/teachers/photo';
import { appDeps } from '@/server/app';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const bytes = await publicPhotoBytes(appDeps(), (await ctx.params).id);
  if (!bytes) return new Response('não encontrado', { status: 404 });
  return new Response(Buffer.from(bytes), {
    headers: {
      'content-type': 'image/webp',
      'cache-control': 'public, max-age=31536000, immutable',
      'content-length': String(bytes.length),
    },
  });
}
