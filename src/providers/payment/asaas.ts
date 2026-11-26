/**
 * Pagamento pelo Asaas (§3.4), conferido com a documentação em 26/11/2026.
 * - Professor: subconta (POST /accounts); recebe pelo walletId.
 * - Cobrança: cliente com CPF/CNPJ de quem paga (exigido pelo Asaas, nunca
 *   guardado aqui), cobrança com split de valor fixo para o professor; a parte
 *   dele fica na Conta Escrow até a liberação (POST /escrow/{id}/finish).
 * - Avisos: webhook com o token no cabeçalho asaas-access-token.
 * Chave e token só em variáveis de ambiente.
 */
import { timingSafeEqual } from 'node:crypto';
import { WebhookSignatureError } from '../errors';
import { header, type HeaderBag } from '../signing';
import type {
  Charge, CreateChargeInput, PaymentEvent, PaymentEventType, PaymentProvider, RecipientAccount, RecipientAccountInput,
} from './types';

export interface AsaasOptions {
  apiKey: string;
  env: 'sandbox' | 'production';
  /** Token que o Asaas manda no cabeçalho asaas-access-token de cada aviso (32 caracteres ou mais). */
  webhookToken: string;
  fetch?: typeof fetch;
}

const reais = (cents: number) => Math.round(cents) / 100;
const PAID = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);
const REFUNDED = new Set(['PAYMENT_REFUNDED']);
const FAILED = new Set(['PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', 'PAYMENT_REPROVED_BY_RISK_ANALYSIS']);
const EXPIRED = new Set(['PAYMENT_OVERDUE', 'PAYMENT_DELETED']);
export const ASAAS_WEBHOOK_EVENTS = [...PAID, ...REFUNDED, ...FAILED, ...EXPIRED];

export class AsaasApiError extends Error {
  constructor(readonly status: number, readonly detail: string) {
    super(`Asaas recusou (${status}): ${detail}`);
  }
}

export class AsaasPaymentProvider implements PaymentProvider {
  readonly name = 'asaas';
  constructor(private readonly opts: AsaasOptions) {}

  private get base() {
    return this.opts.env === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
  }

  private async call<T>(method: string, path: string, body?: unknown, apiKey = this.opts.apiKey): Promise<T> {
    const res = await (this.opts.fetch ?? fetch)(`${this.base}${path}`, {
      method,
      headers: {
        access_token: apiKey, 'content-type': 'application/json', accept: 'application/json',
        'user-agent': 'Reforce/1.0',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as T & { errors?: Array<{ description?: string }> };
    if (!res.ok) throw new AsaasApiError(res.status, data.errors?.map((e) => e.description).join('; ') || 'sem detalhe');
    return data;
  }

  async createRecipientAccount(input: RecipientAccountInput): Promise<RecipientAccount> {
    const a = await this.call<{ id: string; walletId: string; apiKey?: string }>('POST', '/accounts', {
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj,
      birthDate: input.birthDate,
      mobilePhone: input.phone.replace(/^\+55/, ''),
      incomeValue: reais(input.incomeValueCents),
      address: input.address,
      addressNumber: input.addressNumber,
      province: input.province || undefined,
      postalCode: input.postalCode,
      externalReference: input.teacherId,
    });
    // a subconta recebe o split assim que criada; os documentos do professor ficam no próprio Asaas
    return { accountId: a.id, walletId: a.walletId, apiKey: a.apiKey, status: 'active' };
  }

  async createCharge(input: CreateChargeInput): Promise<Charge> {
    if (!input.payer.cpfCnpj) throw new AsaasApiError(400, 'CPF de quem paga é obrigatório');
    const customer = await this.call<{ id: string }>('POST', '/customers', {
      name: input.payer.name,
      cpfCnpj: input.payer.cpfCnpj,
      email: input.payer.email || undefined,
      mobilePhone: input.payer.phone.replace(/^\+55/, ''),
      notificationDisabled: true, // os avisos saem da Reforce, não do Asaas
    });
    const dueDate = input.expiresAt.toZonedDateTimeISO('America/Sao_Paulo').toPlainDate().toString();
    const payment = await this.call<{ id: string; invoiceUrl?: string }>('POST', '/payments', {
      customer: customer.id,
      billingType: input.method === 'pix' ? 'PIX' : 'CREDIT_CARD',
      value: reais(input.amountCents),
      dueDate,
      description: input.description,
      externalReference: input.orderId,
      split: [{ walletId: input.split.walletId, fixedValue: reais(input.split.fixedCents) }],
    });
    if (input.method === 'card') {
      if (!payment.invoiceUrl) throw new AsaasApiError(502, 'cobrança sem link de pagamento');
      return { providerChargeId: payment.id, checkoutData: { card: { checkoutUrl: payment.invoiceUrl } } };
    }
    const qr = await this.call<{ payload: string }>('GET', `/payments/${payment.id}/pixQrCode`);
    return { providerChargeId: payment.id, checkoutData: { pix: { qrPayload: qr.payload, expiresAt: input.expiresAt.toString() } } };
  }

  async cancelCharge(chargeId: string): Promise<void> {
    try {
      await this.call('DELETE', `/payments/${chargeId}`);
    } catch (err) {
      // já removida: nada a fazer
      if (!(err instanceof AsaasApiError && err.status === 404)) throw err;
    }
  }

  async refund(chargeId: string, amountCents?: number): Promise<void> {
    await this.call('POST', `/payments/${chargeId}/refund`, amountCents === undefined ? {} : { value: reais(amountCents) });
  }

  /** A retenção só aparece para a subconta que recebeu o split: usa a chave dela. */
  private escrowOf(chargeId: string, accountKey?: string) {
    if (!accountKey) throw new AsaasApiError(400, 'sem a chave da subconta do professor para consultar a retenção');
    return this.call<{ id: string; status: 'ACTIVE' | 'DONE'; finishReason?: string }>('GET', `/payments/${chargeId}/escrow`, undefined, accountKey);
  }

  async releaseEscrow(chargeId: string, accountKey?: string): Promise<{ status: 'released' | 'pending' }> {
    const e = await this.escrowOf(chargeId, accountKey);
    if (e.status === 'DONE') return { status: 'released' };
    const r = await this.call<{ status?: string }>('POST', `/escrow/${e.id}/finish`, undefined, accountKey);
    return { status: r.status === 'ACTIVE' ? 'pending' : 'released' };
  }

  async getEscrow(chargeId: string, accountKey?: string): Promise<{ status: 'held' | 'released' | 'refunded' }> {
    const e = await this.escrowOf(chargeId, accountKey);
    if (e.status === 'ACTIVE') return { status: 'held' };
    return { status: e.finishReason === 'PAYMENT_REFUNDED' || e.finishReason === 'CHARGEBACK' ? 'refunded' : 'released' };
  }

  parseWebhook(headers: HeaderBag, rawBody: string): PaymentEvent {
    const token = header(headers, 'asaas-access-token') ?? '';
    const a = Buffer.from(token);
    const b = Buffer.from(this.opts.webhookToken);
    if (!this.opts.webhookToken || a.length !== b.length || !timingSafeEqual(a, b)) throw new WebhookSignatureError();
    const body = JSON.parse(rawBody) as { id?: string; event?: string; payment?: { id?: string } };
    if (!body.id || !body.event) throw new WebhookSignatureError();
    const ev = body.event;
    const type: PaymentEventType = PAID.has(ev) ? 'payment.paid' : REFUNDED.has(ev) ? 'payment.refunded'
      : FAILED.has(ev) ? 'payment.failed' : EXPIRED.has(ev) ? 'payment.expired' : 'payment.other';
    return { eventId: body.id, type, chargeId: body.payment?.id ?? '', raw: { event: ev, paymentId: body.payment?.id ?? null } };
  }

  /**
   * Configuração inicial, idempotente: o webhook de pagamento deste site e a
   * Conta Escrow padrão das subcontas (retenção de `escrowDays` dias, liberada
   * antes pela Reforce depois da aula). Rodada pelo worker ao iniciar.
   */
  async ensureSetup(input: { webhookUrl: string; email: string; escrowDays: number }): Promise<string[]> {
    const done: string[] = [];
    const hooks = await this.call<{ data?: Array<{ url?: string }> }>('GET', '/webhooks');
    if (!(hooks.data ?? []).some((h) => h.url === input.webhookUrl)) {
      await this.call('POST', '/webhooks', {
        name: 'Reforce pagamentos', url: input.webhookUrl, email: input.email, enabled: true, interrupted: false,
        apiVersion: 3, authToken: this.opts.webhookToken, sendType: 'SEQUENTIALLY', events: ASAAS_WEBHOOK_EVENTS,
      });
      done.push('webhook cadastrado');
    }
    const escrow = await this.call<{ enabled?: boolean; daysToExpire?: number }>('GET', '/accounts/escrow');
    if (!escrow.enabled || escrow.daysToExpire !== input.escrowDays) {
      await this.call('POST', '/accounts/escrow', { enabled: true, isFeePayer: false, daysToExpire: input.escrowDays });
      done.push(`Conta Escrow padrão: ${input.escrowDays} dias`);
    }
    return done;
  }
}

