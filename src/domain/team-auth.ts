/**
 * Senha da equipe: protege a página /equipe, as planilhas e os currículos
 * (HTTP Basic, com WAITLIST_EXPORT_PASSWORD; o usuário é ignorado). Só usa
 * node:crypto, para poder rodar também no proxy.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

/** O mesmo "realm" em todas as rotas: o navegador pede a senha uma vez só. */
export const TEAM_REALM = 'Lista de espera';

const digest = (s: string) => createHash('sha256').update(s).digest();

export function teamPasswordMatches(password: string | null | undefined, authorization: string | null): boolean {
  if (!password || !authorization?.startsWith('Basic ')) return false;
  const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  if (colon < 0) return false;
  return timingSafeEqual(digest(decoded.slice(colon + 1)), digest(password));
}

/** Resposta que faz o navegador pedir a senha. */
export function teamPasswordChallenge(): Response {
  return new Response('senha necessária', {
    status: 401,
    headers: { 'www-authenticate': `Basic realm="${TEAM_REALM}", charset="UTF-8"`, 'cache-control': 'no-store' },
  });
}
