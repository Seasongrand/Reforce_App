/**
 * Rotas abertas no modo "lista de espera" (SITE_MODE=lista_de_espera): só a
 * página inicial com a inscrição, a política de privacidade, a checagem de
 * saúde e a exportação protegida. O resto do marketplace fica fechado até os
 * provedores reais (e-mail, pagamento, vídeo) estarem configurados.
 */
const OPEN = new Set(['/', '/privacidade', '/api/saude', '/api/lista-de-espera.csv', '/favicon.ico', '/robots.txt']);

export function isPathOpenInWaitlistMode(pathname: string): boolean {
  if (pathname.includes('..')) return false;
  if (pathname.startsWith('/_next/')) return true;
  const clean = pathname.replace(/\/+$/, '') || '/';
  return OPEN.has(clean);
}
