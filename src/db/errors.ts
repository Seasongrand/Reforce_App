/** Códigos de erro do PostgreSQL que a aplicação trata como regra de negócio. */

export function pgCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/**
 * Horário ocupado: a restrição no_double_booking recusou (23P01). O impasse
 * (40P01) também conta: sem a trava por professor, inserções simultâneas que
 * colidem podem ser abortadas assim (observado no teste de 20 sessões).
 */
export function isSlotTaken(err: unknown): boolean {
  const c = pgCode(err);
  return c === '23P01' || c === '40P01';
}

export function isUniqueViolation(err: unknown): boolean {
  return pgCode(err) === '23505';
}
