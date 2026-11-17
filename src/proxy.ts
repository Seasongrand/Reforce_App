/**
 * Proxy do Next.js 16 (antigo middleware), antes de qualquer renderização:
 * - a área da equipe (/equipe) pede a senha das planilhas (HTTP Basic);
 * - no modo lista de espera, fecha as rotas do marketplace.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { isPathOpenInWaitlistMode } from '@/domain/site-mode';
import { TEAM_REALM, teamPasswordMatches } from '@/domain/team-auth';

const TEAM_AREA = /^\/equipe(\/|$)/;
const notFound = () =>
  new NextResponse('Página não encontrada', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (TEAM_AREA.test(path)) {
    const password = process.env.WAITLIST_EXPORT_PASSWORD;
    if (!password) return notFound();
    if (!teamPasswordMatches(password, request.headers.get('authorization'))) {
      return new NextResponse('senha necessária', {
        status: 401,
        headers: { 'www-authenticate': `Basic realm="${TEAM_REALM}", charset="UTF-8"`, 'cache-control': 'no-store' },
      });
    }
  }
  if (process.env.SITE_MODE !== 'lista_de_espera') return NextResponse.next();
  if (isPathOpenInWaitlistMode(path)) return NextResponse.next();
  return notFound();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
