import { DomainError } from '@/domain/errors';

export type ActionState<T = undefined> = { ok: true; data: T } | { ok: false; error: string } | null;

/** Converte erro de regra em mensagem para a tela; o resto vira mensagem genérica. */
export function errorMessage(err: unknown): string {
  if (err instanceof DomainError) return err.message;
  console.error(err);
  return 'Algo deu errado. Tente de novo em instantes.';
}

export const CODE_ERRORS: Record<'invalido' | 'expirado' | 'bloqueado', string> = {
  invalido: 'Código incorreto. Confira e tente de novo.',
  expirado: 'Este código expirou. Peça um novo.',
  bloqueado: 'Tentativas demais com este código. Peça um novo.',
};
