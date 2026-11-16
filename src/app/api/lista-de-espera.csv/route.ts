import { serveWaitlistExport } from '@/domain/waitlist';
import { siteDeps } from '@/server/app';

export const dynamic = 'force-dynamic';

/** Planilha da lista de espera; o navegador pede a senha (WAITLIST_EXPORT_PASSWORD). */
export async function GET(req: Request) {
  return serveWaitlistExport(siteDeps(), req.headers.get('authorization'));
}
