/** Modelos de mensagem e para quem cada um vai. */
export const TEMPLATES = {
  confirmacao_responsavel: 'guardian',
  lembrete_24h_responsavel: 'guardian',
  lembrete_1h_responsavel: 'guardian',
  pagamento_tardio_reembolso: 'guardian',
  falta_professor_reembolso: 'guardian',
  falta_aluno_devolvida: 'guardian',
  confirmacao_professor: 'teacher',
  // cancelar e remarcar (regra do dono, 21/11)
  cancelada_pela_familia: 'teacher',
  cancelamento_confirmado: 'guardian',
  remarcada_professor: 'teacher',
  remarcada_responsavel: 'guardian',
  cancelada_pelo_professor: 'guardian',
  // lembretes ao professor e pedido de avaliação (22/11)
  lembrete_24h_professor: 'teacher',
  lembrete_1h_professor: 'teacher',
  pedido_avaliacao_responsavel: 'guardian',
  // contestação da aula (22/11)
  contestacao_aberta_professor: 'teacher',
  contestacao_aceita_responsavel: 'guardian',
  contestacao_aceita_professor: 'teacher',
  contestacao_negada_responsavel: 'guardian',
  contestacao_negada_professor: 'teacher',
} as const;

export type Template = keyof typeof TEMPLATES;
export type Audience = (typeof TEMPLATES)[Template];
export type Channel = 'whatsapp' | 'email';
