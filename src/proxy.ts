/**
 * Proxy do Next.js 16 (antigo middleware), antes de qualquer renderização:
 * - a área da equipe (/equipe) pede a senha das planilhas (HTTP Basic);
 * - no modo lista de espera, fecha as rotas do marketplace, menos para a
 *   equipe, que traz a mesma senha (regras em src/domain/site-gate.ts);
 * - na primeira visita ao perfil de um professor, marca se a família veio da
 *   busca ou não (comissão; regras em src/domain/family-origin.ts).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { originCookieName, originToRecord, profileSlug } from '@/domain/family-origin';
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
  if (decision === 'next') return withOrigin(request, NextResponse.next());
  if (decision === 'not_found') return notFound();
  return new NextResponse('senha necessária', {
    status: 401,
    headers: { 'www-authenticate': `Basic realm="${TEAM_REALM}", charset="UTF-8"`, 'cache-control': 'no-store' },
  });
}

/** Marca a origem da família na primeira visita ao perfil do professor; depois, nunca troca. */
function withOrigin(request: NextRequest, response: NextResponse): NextResponse {
  const slug = profileSlug(request.nextUrl.pathname);
  if (!slug) return response;
  const name = originCookieName(slug);
  const origin = originToRecord({
    path: request.nextUrl.pathname,
    searchOrigin: request.nextUrl.searchParams.get('origem'),
    existing: request.cookies.get(name)?.value,
  });
  if (origin) {
    response.cookies.set(name, origin, {
      httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', path: '/', maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
