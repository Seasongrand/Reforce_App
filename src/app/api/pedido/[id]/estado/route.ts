import { orderView } from '@/domain/public/order';
import { appDeps, now } from '@/server/app';
import { currentSubject } from '@/server/session';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guardianId = await currentSubject('guardian');
  if (!guardianId) return new Response('não encontrado', { status: 404 });
  const v = await orderView(appDeps(), (await ctx.params).id, guardianId, await now());
  if (!v) return new Response('não encontrado', { status: 404 });
  return Response.json({ status: v.status, bookingStatus: v.bookingStatus });
}
