/** Erro de regra ou de entrada, com mensagem que pode ir para a tela. */
export class DomainError extends Error {
  constructor(
    readonly code: 'not_found' | 'invalid' | 'conflict' | 'forbidden',
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
