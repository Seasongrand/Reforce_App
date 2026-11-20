/** Para onde voltar depois de entrar ou criar a conta: só páginas de Minha conta, para o link não levar a outro lugar. */
export function safeReturnPath(v: unknown): string | null {
  return typeof v === 'string' && /^\/conta(\/[A-Za-z0-9-]+)*$/.test(v) ? v : null;
}
