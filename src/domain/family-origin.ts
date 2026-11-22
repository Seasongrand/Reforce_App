/**
 * Origem da família, que define a comissão (15% pela busca, 5% pelo link do
 * professor). A primeira visita ao perfil do professor marca a origem num
 * cookie por professor, que não muda depois: quem chegou pelo link do
 * professor fica com 5% mesmo que depois o ache na busca (especificação,
 * confirmado pelo dono em 20/11). A reserva e a primeira mensagem gravam a
 * origem no vínculo família–professor, e o primeiro vínculo prevalece.
 * Sem cookie (bloqueado ou apagado), vale o link do professor.
 */
export type FamilyOrigin = 'busca' | 'link';

const PROFILE = /^\/p\/([a-z0-9-]+)$/;

export const originCookieName = (slug: string) => `origem_${slug}`;

/** Na visita ao perfil: a origem a gravar, ou null se não é o perfil ou se a origem já foi marcada. */
export function originToRecord(input: { path: string; searchOrigin: string | null; existing: string | undefined }): FamilyOrigin | null {
  if (!PROFILE.test(input.path) || input.existing) return null;
  return input.searchOrigin === 'busca' ? 'busca' : 'link';
}

/** O slug do professor quando o caminho é o perfil dele. */
export function profileSlug(path: string): string | null {
  return PROFILE.exec(path)?.[1] ?? null;
}

export function acquisitionFor(origin: string | undefined): 'marketplace' | 'teacher_link' {
  return origin === 'busca' ? 'marketplace' : 'teacher_link';
}
