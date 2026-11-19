/**
 * Proxy do Next.js 16 (antigo middleware), antes de qualquer renderização:
 * - a área da equipe (/equipe) pede a senha das planilhas (HTTP Basic);
 * - no modo lista de espera, fecha as rotas do marketplace, menos para a
 *   equipe, que traz a mesma senha (regras em src/domain/site-gate.ts).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { siteGate } from '@/domain/site-gate';
import { TEAM_REALM } from '@/domain/team-auth';

const notFound = () =>
  new NextResponse('Página não encontrada', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });

export function proxy(request: NextRequest) {
  const decision = siteGate({
    path: request.nextUrl.pathname,
    authorization: request.headers.get('authorization'),
    siteMode: process.env.SITE_MODE,
    password: process.env.WAITLIST_EXPORT_PASSWORD,
  });
  if (decision === 'next') return NextResponse.next();
  if (decision === 'not_found') return notFound();
  return new NextResponse('senha necessária', {
    status: 401,
    headers: { 'www-authenticate': `Basic realm="${TEAM_REALM}", charset="UTF-8"`, 'cache-control': 'no-store' },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
