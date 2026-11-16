import { describe, expect, it } from 'vitest';
import { isSlotTaken, isUniqueViolation, pgCode } from '@/db/errors';

const err = (code: string) => Object.assign(new Error('x'), { code });

describe('erros do PostgreSQL', () => {
  it('23P01 (exclusão) e 40P01 (impasse) contam como horário ocupado', () => {
    expect(isSlotTaken(err('23P01'))).toBe(true);
    expect(isSlotTaken(err('40P01'))).toBe(true);
    expect(isSlotTaken(err('23505'))).toBe(false);
    expect(isSlotTaken(new Error('sem código'))).toBe(false);
  });

  it('reconhece violação de chave única e lê o código com segurança', () => {
    expect(isUniqueViolation(err('23505'))).toBe(true);
    expect(pgCode('não é erro')).toBeUndefined();
  });
});
