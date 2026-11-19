/**
 * Porteiro do site, decidido no proxy antes de qualquer renderização:
 * - a área da equipe (/equipe) pede a senha das planilhas (HTTP Basic);
 * - no modo lista de espera, as rotas do marketplace ficam fechadas (404)
 *   para o público e abertas para a equipe, que traz a mesma senha (depois
 *   de entrar em /equipe, o navegador a reenvia para o site todo).
 * Só usa node:crypto (via team-auth), para poder rodar no proxy.
 */
import { isPathOpenInWaitlistMode } from './site-mode';
import { teamPasswordMatches } from './team-auth';

export type GateDecision = 'next' | 'not_found' | 'challenge';

const TEAM_AREA = /^\/equipe(\/|$)/;

export function siteGate(input: {
  path: string;
  authorization: string | null;
  siteMode: string | undefined;
  password: string | undefined;
}): GateDecision {
  const team = teamPasswordMatches(input.password, input.authorization);
  if (TEAM_AREA.test(input.path)) {
    if (!input.password) return 'not_found';
    if (!team) return 'challenge';
  }
  if (input.siteMode !== 'lista_de_espera') return 'next';
  return isPathOpenInWaitlistMode(input.path) || team ? 'next' : 'not_found';
}
