/** Pagamento pelo Asaas: chamadas à API (sem rede), avisos com token e configuração. */
import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { loadConfig } from '@/config';
import { WebhookSignatureError } from '@/providers/errors';
import { AsaasPaymentProvider } from '@/providers/payment/asaas';

const TOKEN = 't'.repeat(40);
function api(responses: Array<{ status?: number; body: unknown }>) {
  const calls: Array<{ url: string; method: string; body: unknown; key: string | undefined }> = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(String(init.body)) : undefined, key: (init.headers as Record<string, string>).access_token });
    const r = responses.shift() ?? { body: {} };
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  }) as unknown as typeof globalThis.fetch;
  return { calls, p: new AsaasPaymentProvider({ apiKey: 'chave-teste', env: 'sandbox', webhookToken: TOKEN, fetch }) };
}
const charge = (method: 'pix' | 'card' = 'pix', cpf: string | undefined = '24971563792') => ({
  orderId: 'o1', method, amountCents: 12100, description: 'Aula particular (Matemática)',
  split: { walletId: 'wal_1', fixedCents: 11495 }, escrow: true as const,
  expiresAt: Temporal.Instant.from('2026-12-01T17:00:00Z'),
  payer: { name: 'Maria', email: 'maria@exemplo.com', phone: '+5511988887777', cpfCnpj: cpf },
});

describe('AsaasPaymentProvider', () => {
  it('cobrança PIX: cria o cliente com o CPF, a cobrança com split de valor fixo e devolve o copia-e-cola', async () => {
    const { calls, p } = api([{ body: { id: 'cus_1' } }, { body: { id: 'pay_1' } }, { body: { payload: '000201PIX' } }]);
    expect(await p.createCharge(charge())).toEqual({
      providerChargeId: 'pay_1', checkoutData: { pix: { qrPayload: '000201PIX', expiresAt: '2026-12-01T17:00:00Z' } },
    });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'POST https://api-sandbox.asaas.com/v3/customers',
      'POST https://api-sandbox.asaas.com/v3/payments',
      'GET https://api-sandbox.asaas.com/v3/payments/pay_1/pixQrCode',
    ]);
    expect(calls[0]!.key).toBe('chave-teste');
    expect(calls[0]!.body).toMatchObject({ cpfCnpj: '24971563792', mobilePhone: '11988887777', notificationDisabled: true });
    expect(calls[1]!.body).toEqual({
      customer: 'cus_1', billingType: 'PIX', value: 121, dueDate: '2026-12-01', description: 'Aula particular (Matemática)',
      externalReference: 'o1', split: [{ walletId: 'wal_1', fixedValue: 114.95 }],
    });
  });

  it('cartão: devolve o link de pagamento do Asaas', async () => {
    const { p } = api([{ body: { id: 'cus_1' } }, { body: { id: 'pay_2', invoiceUrl: 'https://sandbox.asaas.com/i/pay_2' } }]);
    expect((await p.createCharge(charge('card'))).checkoutData).toEqual({ card: { checkoutUrl: 'https://sandbox.asaas.com/i/pay_2' } });
  });

  it('sem CPF de quem paga, nem chama a API; erro da API vira exceção com o motivo', async () => {
    const a = api([]);
    await expect(a.p.createCharge(charge('pix', ''))).rejects.toThrow(/CPF/);
    expect(a.calls).toEqual([]);
    const b = api([{ status: 400, body: { errors: [{ description: 'A criação de Split de pagamento está desabilitada.' }] } }]);
    await expect(b.p.createCharge(charge())).rejects.toThrow(/400.*Split/);
  });

  it('conta do professor: subconta com renda em reais; devolve conta e carteira', async () => {
    const { calls, p } = api([{ body: { id: 'acc_1', walletId: 'wal_9', apiKey: 'chave-da-subconta' } }]);
    expect(await p.createRecipientAccount({
      teacherId: 't1', name: 'Ana', email: 'ana@exemplo.com', cpfCnpj: '52998224725', birthDate: '1990-05-10',
      phone: '+5511977776666', postalCode: '01310100', address: 'Av. Paulista', addressNumber: '1000', incomeValueCents: 500000,
    })).toEqual({ accountId: 'acc_1', walletId: 'wal_9', apiKey: 'chave-da-subconta', status: 'active' });
    expect(calls[0]!.body).toMatchObject({ incomeValue: 5000, mobilePhone: '11977776666', externalReference: 't1' });
  });

  it('retenção, com a chave da subconta: ativa = retida; liberar encerra a garantia; devolvida conta como devolvida', async () => {
    const a = api([{ body: { id: 'esc_1', status: 'ACTIVE' } }]);
    expect(await a.p.getEscrow('pay_1', 'chave-subconta')).toEqual({ status: 'held' });
    expect(a.calls[0]!.key).toBe('chave-subconta');
    const b = api([{ body: { id: 'esc_1', status: 'ACTIVE' } }, { body: { status: 'DONE' } }]);
    expect(await b.p.releaseEscrow('pay_1', 'chave-subconta')).toEqual({ status: 'released' });
    expect(b.calls[1]).toMatchObject({ url: 'https://api-sandbox.asaas.com/v3/escrow/esc_1/finish', key: 'chave-subconta' });
    const c = api([{ body: { id: 'esc_1', status: 'DONE', finishReason: 'PAYMENT_REFUNDED' } }]);
    expect(await c.p.getEscrow('pay_1', 'chave-subconta')).toEqual({ status: 'refunded' });
    const d = api([]);
    await expect(d.p.getEscrow('pay_1')).rejects.toThrow(/chave da subconta/);
    expect(d.calls).toEqual([]);
  });

  it('devolução parcial em reais; cancelar cobrança já removida não é erro', async () => {
    const a = api([{ body: {} }]);
    await a.p.refund('pay_1', 605);
    expect(a.calls[0]).toMatchObject({ method: 'POST', url: 'https://api-sandbox.asaas.com/v3/payments/pay_1/refund', body: { value: 6.05 } });
    const b = api([{ status: 404, body: { errors: [{ description: 'não encontrada' }] } }]);
    await expect(b.p.cancelCharge('pay_x')).resolves.toBeUndefined();
  });

  it('aviso: confere o token; pago, devolvido, vencido e outros', () => {
    const { p } = api([]);
    const ev = (event: string) => p.parseWebhook({ 'asaas-access-token': TOKEN }, JSON.stringify({ id: `evt_${event}`, event, payment: { id: 'pay_1' } }));
    expect(ev('PAYMENT_RECEIVED')).toMatchObject({ eventId: 'evt_PAYMENT_RECEIVED', type: 'payment.paid', chargeId: 'pay_1' });
    expect(ev('PAYMENT_CONFIRMED').type).toBe('payment.paid');
    expect(ev('PAYMENT_REFUNDED').type).toBe('payment.refunded');
    expect(ev('PAYMENT_OVERDUE').type).toBe('payment.expired');
    expect(ev('PAYMENT_CREATED').type).toBe('payment.other');
    expect(() => p.parseWebhook({ 'asaas-access-token': 'errado' }, '{"id":"e","event":"PAYMENT_RECEIVED"}')).toThrow(WebhookSignatureError);
    expect(() => p.parseWebhook({}, '{}')).toThrow(WebhookSignatureError);
  });

  it('produção usa a API de produção', async () => {
    const calls: string[] = [];
    const fetch = (async (url: string) => { calls.push(url); return new Response('{"id":"esc","status":"ACTIVE"}'); }) as unknown as typeof globalThis.fetch;
    await new AsaasPaymentProvider({ apiKey: 'k', env: 'production', webhookToken: TOKEN, fetch }).getEscrow('pay_1', 'chave-subconta');
    expect(calls[0]).toBe('https://api.asaas.com/v3/payments/pay_1/escrow');
  });
});

describe('configuração do pagamento', () => {
  const base = { DATABASE_URL: 'postgres://u:p@localhost:5433/aulas', APP_BASE_URL: 'http://localhost:3000', SESSION_SECRET: 's'.repeat(32), FILE_ENCRYPTION_KEY: 'a'.repeat(64) };
  it('PAYMENT_PROVIDER=asaas exige chave e token do webhook; sandbox e 45 dias de retenção por padrão', () => {
    expect(() => loadConfig({ ...base, PAYMENT_PROVIDER: 'asaas' })).toThrow(/ASAAS_API_KEY[\s\S]*ASAAS_WEBHOOK_TOKEN/);
    const c = loadConfig({ ...base, PAYMENT_PROVIDER: 'asaas', ASAAS_API_KEY: 'chave-teste', ASAAS_WEBHOOK_TOKEN: TOKEN });
    expect(c.asaas).toEqual({ apiKey: 'chave-teste', env: 'sandbox', webhookToken: TOKEN, escrowDays: 45 });
    expect(() => loadConfig({ ...base, ASAAS_ESCROW_DAYS: '60' })).toThrow(/ASAAS_ESCROW_DAYS/);
  });
});
