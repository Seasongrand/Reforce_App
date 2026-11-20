/** Para onde voltar depois de entrar: só páginas da própria conta, nunca outro site. */
import { describe, expect, it } from 'vitest';
import { safeReturnPath } from '@/lib/return-path';

describe('volta depois de entrar', () => {
  it.each(['/conta', '/conta/mensagens', '/conta/mensagens/ana-matematica'])('%s vale', (p) => expect(safeReturnPath(p)).toBe(p));
  it.each([null, '', 'https://golpe.com', '//golpe.com', '/conta/../professor', '/professor', '/conta?x=1', '/conta/mensagens/a b', 42])(
    '%s não vale', (p) => expect(safeReturnPath(p)).toBeNull(),
  );
});
