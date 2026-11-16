/** Assinatura do webhook ausente ou inválida: a notificação é descartada. */
export class WebhookSignatureError extends Error {
  constructor(message = 'assinatura do webhook inválida') {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}

/** Adaptador real escolhido na configuração, mas ainda sem implementação/credenciais. */
export class ProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderNotConfiguredError';
  }
}

/** Falha simulada por um adaptador falso (FAKE_FAIL). */
export class SimulatedFailure extends Error {
  constructor(operation: string) {
    super(`falha simulada em ${operation}`);
    this.name = 'SimulatedFailure';
  }
}
