import type { Temporal } from 'temporal-polyfill';
import type { HeaderBag } from '../signing';

export type PaymentMethod = 'pix' | 'card';

export interface RecipientAccountInput {
  teacherId: string;
  name: string;
  email: string;
  /** CPF ou CNPJ: enviado ao provedor, nunca guardado pela plataforma. */
  cpfCnpj: string;
  birthDate: string;
  phone: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  province?: string;
  incomeValueCents: number;
}

export interface RecipientAccount {
  accountId: string;
  walletId: string;
  status: 'pending' | 'active';
}

export interface CreateChargeInput {
  orderId: string;
  method: PaymentMethod;
  amountCents: number;
  description: string;
  /** Professor recebe valor fixo, calculado sobre o preço cheio (§3.4). */
  split: { walletId: string; fixedCents: number };
  /** Parte do professor retida até a liberação (Conta Escrow). */
  escrow: true;
  expiresAt: Temporal.Instant;
  /** CPF ou CNPJ de quem paga: o Asaas exige; vai ao provedor e nunca é guardado pela plataforma. */
  payer: { name: string; email?: string | null; phone: string; cpfCnpj?: string };
}

export interface CheckoutData {
  pix?: { qrPayload: string; expiresAt: string };
  card?: { checkoutUrl: string };
}

export interface Charge {
  providerChargeId: string;
  checkoutData: CheckoutData;
}

/** 'payment.other': aviso que não muda nada aqui (o provedor manda vários tipos). */
export type PaymentEventType = 'payment.paid' | 'payment.refunded' | 'payment.failed' | 'payment.expired' | 'payment.other';

export interface PaymentEvent {
  eventId: string;
  type: PaymentEventType;
  chargeId: string;
  raw: unknown;
}

/**
 * Interface do provedor de pagamento (§3.4): as cinco operações do documento
 * (criar cobrança, cancelar, devolver, liberar retenção, tratar notificação)
 * mais conta de recebimento e consulta da retenção (o Asaas não avisa a liberação).
 */
export interface PaymentProvider {
  readonly name: string;
  createRecipientAccount(input: RecipientAccountInput): Promise<RecipientAccount>;
  createCharge(input: CreateChargeInput): Promise<Charge>;
  cancelCharge(chargeId: string): Promise<void>;
  refund(chargeId: string, amountCents?: number): Promise<void>;
  releaseEscrow(chargeId: string): Promise<{ status: 'released' | 'pending' }>;
  getEscrow(chargeId: string): Promise<{ status: 'held' | 'released' | 'refunded' }>;
  /** Valida a assinatura e traduz a notificação; lança WebhookSignatureError. */
  parseWebhook(headers: HeaderBag, rawBody: string): PaymentEvent;
}
