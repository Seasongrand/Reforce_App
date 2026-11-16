import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import type { Db } from '@/db/client';
import { recordCall } from '../dev-log';
import { SimulatedFailure, WebhookSignatureError } from '../errors';
import { hmacHex, header, safeEqualHex, type HeaderBag } from '../signing';
import type {
  Charge, CreateChargeInput, PaymentEvent, PaymentEventType, PaymentProvider, RecipientAccount, RecipientAccountInput,
} from './types';

const SIG = 'x-fake-signature';

export class FakePaymentProvider implements PaymentProvider {
  readonly name = 'fake';
  private readonly failOn: Set<string>;

  constructor(
    private readonly db: Db,
    private readonly opts: { webhookSecret: string; appBaseUrl: string; failOn?: string[] },
  ) {
    this.failOn = new Set(opts.failOn ?? []);
  }

  private maybeFail(op: string) {
    if (this.failOn.has(op)) throw new SimulatedFailure(op);
  }

  async createRecipientAccount(input: RecipientAccountInput): Promise<RecipientAccount> {
    this.maybeFail('createRecipientAccount');
    const accountId = `fake_acc_${randomUUID()}`;
    // registra só o que identifica a conta: CPF, nascimento e endereço não ficam guardados
    await recordCall(this.db, this.name, 'createRecipientAccount', accountId, { teacherId: input.teacherId });
    return { accountId, walletId: `fake_wal_${randomUUID()}`, status: 'active' };
  }

  async createCharge(input: CreateChargeInput): Promise<Charge> {
    this.maybeFail('createCharge');
    const providerChargeId = `fake_ch_${randomUUID()}`;
    await recordCall(this.db, this.name, 'createCharge', providerChargeId, {
      orderId: input.orderId, method: input.method, amountCents: input.amountCents, split: input.split,
      escrow: input.escrow, expiresAt: input.expiresAt.toString(),
    });
    return {
      providerChargeId,
      checkoutData:
        input.method === 'pix'
          ? { pix: { qrPayload: `FAKEPIX|${providerChargeId}|${input.amountCents}`, expiresAt: input.expiresAt.toString() } }
          : { card: { checkoutUrl: `${this.opts.appBaseUrl}/dev/pagamento/${providerChargeId}` } },
    };
  }

  async cancelCharge(chargeId: string): Promise<void> {
    this.maybeFail('cancelCharge');
    await recordCall(this.db, this.name, 'cancelCharge', chargeId);
  }

  async refund(chargeId: string, amountCents?: number): Promise<void> {
    this.maybeFail('refund');
    await recordCall(this.db, this.name, 'refund', chargeId, { amountCents: amountCents ?? null });
  }

  async releaseEscrow(chargeId: string): Promise<{ status: 'released' | 'pending' }> {
    // o provedor libera; se a falha simulada estiver ligada, a resposta "se perde"
    await recordCall(this.db, this.name, 'releaseEscrow', chargeId);
    this.maybeFail('releaseEscrow');
    return { status: 'released' };
  }

  async getEscrow(chargeId: string): Promise<{ status: 'held' | 'released' | 'refunded' }> {
    const { rows } = await sql<{ operation: string }>`
      SELECT DISTINCT operation FROM dev_provider_calls
       WHERE ref = ${chargeId} AND operation IN ('refund','releaseEscrow')`.execute(this.db);
    const ops = new Set(rows.map((r) => r.operation));
    if (ops.has('refund')) return { status: 'refunded' };
    if (ops.has('releaseEscrow')) return { status: 'released' };
    return { status: 'held' };
  }

  parseWebhook(headers: HeaderBag, rawBody: string): PaymentEvent {
    const sig = header(headers, SIG);
    if (!sig || !safeEqualHex(sig, hmacHex(this.opts.webhookSecret, rawBody))) throw new WebhookSignatureError();
    const body = JSON.parse(rawBody) as { id: string; type: PaymentEventType; chargeId: string };
    return { eventId: body.id, type: body.type, chargeId: body.chargeId, raw: body };
  }

  /** Monta uma notificação assinada, como o provedor enviaria (usada em /dev e nos testes). */
  simulateEvent(chargeId: string, type: PaymentEventType, eventId: string = randomUUID()) {
    const body = JSON.stringify({ id: eventId, type, chargeId });
    return { headers: { [SIG]: hmacHex(this.opts.webhookSecret, body) }, body };
  }
}
