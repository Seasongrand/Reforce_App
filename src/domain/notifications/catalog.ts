/** Modelos de mensagem e para quem cada um vai. */
export const TEMPLATES = {
  confirmacao_responsavel: 'guardian',
  lembrete_24h_responsavel: 'guardian',
  lembrete_1h_responsavel: 'guardian',
  pagamento_tardio_reembolso: 'guardian',
  falta_professor_reembolso: 'guardian',
  confirmacao_professor: 'teacher',
} as const;

export type Template = keyof typeof TEMPLATES;
export type Audience = (typeof TEMPLATES)[Template];
export type Channel = 'whatsapp' | 'email';
