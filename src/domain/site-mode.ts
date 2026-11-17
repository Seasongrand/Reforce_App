/**
 * Rotas abertas no modo "lista de espera" (SITE_MODE=lista_de_espera): só a
 * página inicial com a inscrição, a política de privacidade, a checagem de
 * saúde, a página "Entrar" (aviso da abertura para alunos) e as exportações
 * protegidas. O resto do marketplace fica fechado até os
 * provedores reais (e-mail, pagamento, vídeo) estarem configurados.
 */
const OPEN = new Set([
  '/', '/privacidade', '/api/saude', '/api/lista-de-espera.csv', '/favicon.ico', '/robots.txt',
  '/professores', // página dos professores (também em "/" neste modo)
  '/icon.svg', // ícone do site (src/app/icon.svg)
  '/entrar', // botão "Entrar": aluno pede aviso da abertura
  '/api/lista-de-espera/alunos.csv', // planilha dos alunos que pediram aviso (com senha)
]);

/** Currículo de uma inscrição (com a senha da planilha). */
const WAITLIST_CV = /^\/api\/lista-de-espera\/curriculo\/[0-9a-f-]{36}$/i;

/** Prévia do link (src/app/(site)/opengraph-image.tsx): dentro de um grupo de rotas, o Next acrescenta um sufixo. */
const OG_IMAGE = /^\/opengraph-image(-[a-z0-9]+)?$/;

export function isPathOpenInWaitlistMode(pathname: string): boolean {
  if (pathname.includes('..')) return false;
  if (pathname.startsWith('/_next/')) return true;
  const clean = pathname.replace(/\/+$/, '') || '/';
  return OPEN.has(clean) || OG_IMAGE.test(clean) || WAITLIST_CV.test(clean);
}
