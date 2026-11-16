/**
 * Proxy do Next.js 16 (antigo middleware): no modo lista de espera, fecha as
 * rotas do marketplace antes de qualquer renderização.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { isPathOpenInWaitlistMode } from '@/domain/site-mode';

export function proxy(request: NextRequest) {
  if (process.env.SITE_MODE !== 'lista_de_espera') return NextResponse.next();
  if (isPathOpenInWaitlistMode(request.nextUrl.pathname)) return NextResponse.next();
  return new NextResponse('Página não encontrada', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
