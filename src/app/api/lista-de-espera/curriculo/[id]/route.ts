/** Currículo de uma inscrição na lista de espera: só para a equipe, com a senha da planilha. */
import { serveWaitlistCv } from '@/domain/waitlist';
import { siteDeps } from '@/server/app';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return serveWaitlistCv(siteDeps(), req.headers.get('authorization'), (await ctx.params).id);
}
