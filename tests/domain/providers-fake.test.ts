/**
 * Adaptadores falsos: comportam-se como os reais nas bordas que o sistema usa
 * (assinatura de webhook, retenção, cifragem de arquivos) e registram tudo
 * em tabelas dev_* para os testes conferirem.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { Temporal } from 'temporal-polyfill';
import { sql } from 'kysely';
import { WebhookSignatureError } from '@/providers/errors';
import { FakePaymentProvider } from '@/providers/payment/fake';
import { FakeVideoProvider } from '@/providers/video/fake';
import { FakeWhatsAppSender } from '@/providers/whatsapp/fake';
import { FakeEmailSender } from '@/providers/email/fake';
import { FakeCalendarProvider } from '@/providers/calendar/fake';
import { LocalEncryptedStorage } from '@/providers/storage/local';
import { FakeGeocoder } from '@/providers/geocoding/fake';
import { providers } from '@/providers';
import { getClock, setDevClockOffset } from '@/time/dev-clock';
import { closeTestPool, truncateAll } from '../helpers/db';
import { appDb, closeAppDb, testConfig, TEST_FILE_KEY } from '../helpers/app';
import { insertTeacher } from '../helpers/fixtures';
import { testPool } from '../helpers/db';

beforeEach(truncateAll);
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const SECRET = 'segredo-de-teste-dos-webhooks-falsos';
const calls = async (operation: string) =>
  (await sql<{ ref: string }>`SELECT ref FROM dev_provider_calls WHERE operation = ${operation} ORDER BY id`.execute(appDb()))
    .rows.map((r) => r.ref);

describe('pagamento falso', () => {
  const pay = () => new FakePaymentProvider(appDb(), { webhookSecret: SECRET, appBaseUrl: 'http://localhost:3000' });

  it('cria cobrança PIX com expiração e registra a chamada', async () => {
    const expiresAt = Temporal.Instant.from('2026-11-17T17:09:00Z');
    const charge = await pay().createCharge({
      orderId: 'o1', method: 'pix', amountCents: 12100, description: 'Aula',
      split: { walletId: 'w1', fixedCents: 11495 }, escrow: true, expiresAt,
      payer: { name: 'Maria', phone: '+5511988887777', email: 'm@exemplo.com' },
    });
    expect(charge.providerChargeId).toMatch(/^fake_ch_/);
    expect(charge.checkoutData.pix?.expiresAt).toBe('2026-11-17T17:09:00Z');
    expect(charge.checkoutData.pix?.qrPayload).toContain('12100');
    expect(await calls('createCharge')).toEqual([charge.providerChargeId]);
  });

  it('webhook com assinatura certa vira evento; com assinatura errada é recusado', async () => {
    const p = pay();
    const { headers, body } = p.simulateEvent('fake_ch_1', 'payment.paid', 'ev-1');
    expect(p.parseWebhook(headers, body)).toMatchObject({ eventId: 'ev-1', type: 'payment.paid', chargeId: 'fake_ch_1' });
    expect(() => p.parseWebhook({ ...headers, 'x-fake-signature': 'f'.repeat(64) }, body)).toThrow(WebhookSignatureError);
    expect(() => p.parseWebhook({}, body)).toThrow(WebhookSignatureError);
    expect(() => p.parseWebhook(headers, body.replace('payment.paid', 'payment.refunded'))).toThrow(WebhookSignatureError);
  });

  it('retenção: liberar e devolver mudam o que a consulta da retenção responde', async () => {
    const p = pay();
    expect((await p.getEscrow('ch-a')).status).toBe('held');
    expect((await p.releaseEscrow('ch-a')).status).toBe('released');
    expect((await p.getEscrow('ch-a')).status).toBe('released');
    await p.refund('ch-b');
    expect((await p.getEscrow('ch-b')).status).toBe('refunded');
  });

  it('falha simulada na liberação: a chamada perde a resposta, mas o provedor liberou', async () => {
    const p = new FakePaymentProvider(appDb(), { webhookSecret: SECRET, appBaseUrl: 'x', failOn: ['releaseEscrow'] });
    await expect(p.releaseEscrow('ch-c')).rejects.toThrow(/simulada/);
    expect((await p.getEscrow('ch-c')).status).toBe('released');
  });

  it('cria conta de recebimento ativa', async () => {
    const acc = await pay().createRecipientAccount({
      teacherId: 't1', name: 'Ana', email: 'a@exemplo.com', cpfCnpj: '12345678909', birthDate: '1990-01-01',
      phone: '+5511988887777', postalCode: '01310100', address: 'Av. Paulista', addressNumber: '1000',
      incomeValueCents: 500000,
    });
    expect(acc).toMatchObject({ status: 'active' });
    expect(acc.walletId).toMatch(/^fake_wal_/);
    // o CPF não é registrado nas chamadas guardadas
    const { rows } = await sql<{ payload: unknown }>`SELECT payload FROM dev_provider_calls`.execute(appDb());
    expect(JSON.stringify(rows)).not.toContain('12345678909');
  });
});

describe('vídeo falso', () => {
  const video = () => new FakeVideoProvider(appDb(), { webhookSecret: SECRET, appBaseUrl: 'http://localhost:3000' });

  it('cria sala e emite acesso por participante', async () => {
    const v = video();
    const { roomName } = await v.createRoom({
      bookingId: 'b1', startsAt: Temporal.Instant.from('2026-11-17T17:00:00Z'), endsAt: Temporal.Instant.from('2026-11-17T18:00:00Z'),
    });
    const { joinUrl } = await v.issueAccess({
      roomName, role: 'teacher', displayName: 'Ana',
      validFrom: Temporal.Instant.from('2026-11-17T16:50:00Z'), validUntil: Temporal.Instant.from('2026-11-17T18:30:00Z'),
    });
    expect(joinUrl).toContain(`/dev/sala/${roomName}`);
    expect(joinUrl).toContain('role=teacher');
  });

  it('presença por webhook assinado', () => {
    const v = video();
    const at = Temporal.Instant.from('2026-11-17T17:01:00Z');
    const { headers, body } = v.simulatePresence('fake-room-b1', 'student', 'joined', at, 'pv-1');
    expect(v.parsePresenceWebhook(headers, body)).toEqual([
      { eventId: 'pv-1', roomName: 'fake-room-b1', role: 'student', kind: 'joined', at },
    ]);
    expect(() => v.parsePresenceWebhook({ 'x-fake-signature': '0'.repeat(64) }, body)).toThrow(WebhookSignatureError);
  });
});

describe('mensagens falsas', () => {
  it('WhatsApp e e-mail vão para a caixa de saída de desenvolvimento', async () => {
    await new FakeWhatsAppSender(appDb()).send({ to: '+5511988887777', template: 'confirmacao_responsavel', vars: { nome: 'Maria' } });
    await new FakeEmailSender(appDb()).send({ to: 'm@exemplo.com', subject: 'Aula confirmada', text: 'Olá' });
    const { rows } = await sql<{ channel: string; recipient: string }>`
      SELECT channel, recipient FROM dev_outbox ORDER BY id`.execute(appDb());
    expect(rows).toEqual([
      { channel: 'whatsapp', recipient: '+5511988887777' },
      { channel: 'email', recipient: 'm@exemplo.com' },
    ]);
  });
});

describe('calendário falso', () => {
  it('livre/ocupado devolve só os intervalos simulados que tocam o período', async () => {
    const teacherId = await insertTeacher(testPool());
    await testPool().query(
      `INSERT INTO dev_calendar_busy (teacher_id, during) VALUES
         ($1, tstzrange('2026-11-17 19:30Z', '2026-11-17 20:00Z')),
         ($1, tstzrange('2026-12-17 19:30Z', '2026-12-17 20:00Z'))`,
      [teacherId],
    );
    const cal = new FakeCalendarProvider(appDb());
    const busy = await cal.freeBusy(
      { teacherId, connectionId: 'c1' },
      { start: Temporal.Instant.from('2026-11-17T00:00:00Z'), end: Temporal.Instant.from('2026-11-18T00:00:00Z') },
    );
    expect(busy.map((b) => [b.start.toString(), b.end.toString()])).toEqual([
      ['2026-11-17T19:30:00Z', '2026-11-17T20:00:00Z'],
    ]);
  });

  it('pode simular o Google fora do ar', async () => {
    const cal = new FakeCalendarProvider(appDb(), { failOn: ['freeBusy'] });
    await expect(
      cal.freeBusy({ teacherId: 't', connectionId: 'c' }, { start: Temporal.Now.instant(), end: Temporal.Now.instant() }),
    ).rejects.toThrow(/simulada/);
  });
});

describe('armazenamento privado cifrado', () => {
  const dir = path.resolve('var/test-private');
  const storage = () => new LocalEncryptedStorage({ dir, keyHex: TEST_FILE_KEY, signingSecret: SECRET, baseUrl: 'http://x' });

  it('grava cifrado: o arquivo em disco não contém o texto original e volta igual', async () => {
    const s = storage();
    const content = new TextEncoder().encode('RG 12.345.678-9 — documento da professora');
    await s.put('verificacoes/t1/v1/identidade.txt', content, 'text/plain');
    const files = await readdir(path.join(dir, 'verificacoes/t1/v1'));
    const raw = await readFile(path.join(dir, 'verificacoes/t1/v1', files[0]!));
    expect(raw.toString('latin1')).not.toContain('12.345.678');
    const back = await s.get('verificacoes/t1/v1/identidade.txt');
    expect(new TextDecoder().decode(back.bytes)).toBe('RG 12.345.678-9 — documento da professora');
    expect(back.contentType).toBe('text/plain');
  });

  it('link assinado vale até expirar e não serve para outro arquivo', () => {
    const s = storage();
    const now = Temporal.Instant.from('2026-11-17T17:00:00Z');
    const url = new URL(s.signedUrl('a/b.pdf', 300, now));
    const exp = url.searchParams.get('exp')!;
    const sig = url.searchParams.get('sig')!;
    expect(s.verifySignature('a/b.pdf', exp, sig, now.add({ seconds: 299 }))).toBe(true);
    expect(s.verifySignature('a/b.pdf', exp, sig, now.add({ seconds: 301 }))).toBe(false);
    expect(s.verifySignature('a/c.pdf', exp, sig, now)).toBe(false);
  });

  it('recusa chave que tenta sair da pasta', async () => {
    await expect(storage().put('../fora.txt', new Uint8Array([1]), 'text/plain')).rejects.toThrow(/chave inválida/);
  });

  it('recusa chave de cifragem com tamanho errado', () => {
    expect(() => new LocalEncryptedStorage({ dir, keyHex: 'abc', signingSecret: SECRET, baseUrl: 'x' })).toThrow(/FILE_ENCRYPTION_KEY/);
  });
});

describe('CEP para coordenadas (falso)', () => {
  it('conhece alguns CEPs de teste, com ou sem hífen', async () => {
    const g = new FakeGeocoder();
    expect(await g.cepToLatLng('01310-100')).toEqual(await g.cepToLatLng('01310100'));
    expect(await g.cepToLatLng('01310-100')).not.toBeNull();
    expect(await g.cepToLatLng('99999-999')).toBeNull();
  });
});

describe('fábrica de provedores', () => {
  it('monta os falsos quando configurado', () => {
    const p = providers(appDb(), testConfig());
    expect(p.payment.name).toBe('fake');
    expect(p.video.name).toBe('fake');
  });

  it('adaptador real sem implementação falha com mensagem clara', () => {
    expect(() => providers(appDb(), testConfig({ WHATSAPP_PROVIDER: 'meta' }))).toThrow(/WhatsApp.*credenciais/);
  });
});

describe('relógio de desenvolvimento', () => {
  it('com DEV_TOOLS, soma o deslocamento guardado no banco; sem, ignora', async () => {
    await setDevClockOffset(appDb(), { hours: 26 });
    const real = Temporal.Now.instant();
    const dev = (await getClock(appDb(), { devTools: true })).now();
    const diffH = dev.since(real).total({ unit: 'hours' });
    expect(diffH).toBeGreaterThan(25.9);
    expect(diffH).toBeLessThan(26.1);
    const prod = (await getClock(appDb(), { devTools: false })).now();
    expect(Math.abs(prod.since(real).total({ unit: 'seconds' }))).toBeLessThan(5);
  });
});
