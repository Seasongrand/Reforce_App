/** Sala de vídeo pelo Daily: chamadas à API, acesso por participante e presença assinada. */
import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { Temporal } from 'temporal-polyfill';
import { loadConfig } from '@/config';
import { WebhookSignatureError } from '@/providers/errors';
import { DailyVideoProvider } from '@/providers/video/daily';

const SECRET = Buffer.alloc(32, 7).toString('base64');
const START = Temporal.Instant.from('2026-12-01T17:00:00Z');
const END = START.add({ minutes: 60 });

function api(responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; method: string; body: unknown; auth: string }> = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(String(init.body)) : undefined, auth: (init.headers as Record<string, string>).authorization ?? "" });
    const r = responses.shift() ?? { status: 200, body: {} };
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as unknown as typeof globalThis.fetch;
  return { calls, provider: new DailyVideoProvider({ apiKey: 'chave-teste-123', domain: 'reforce', webhookSecret: SECRET, fetch }) };
}

function signed(body: unknown, ts = '1764608400') {
  const raw = JSON.stringify(body);
  const sig = createHmac('sha256', Buffer.from(SECRET, 'base64')).update(`${ts}.${raw}`).digest('base64');
  return { headers: { 'X-Webhook-Timestamp': ts, 'X-Webhook-Signature': sig }, raw };
}

describe('DailyVideoProvider', () => {
  it('cria sala privada que abre 10 min antes e fecha 30 min depois; sala repetida não é erro', async () => {
    const { calls, provider } = api([{ status: 200, body: { name: 'aula-b1' } }, { status: 400, body: { info: 'a room named aula-b1 already exists' } }]);
    expect(await provider.createRoom({ bookingId: 'b1', startsAt: START, endsAt: END })).toEqual({ roomName: 'aula-b1' });
    expect(calls[0]).toMatchObject({
      url: 'https://api.daily.co/v1/rooms', method: 'POST', auth: 'Bearer chave-teste-123',
      body: { name: 'aula-b1', privacy: 'private', properties: {
        nbf: START.epochMilliseconds / 1000 - 600, exp: END.epochMilliseconds / 1000 + 1800, eject_at_room_exp: true } },
    });
    await expect(provider.createRoom({ bookingId: 'b1', startsAt: START, endsAt: END })).resolves.toEqual({ roomName: 'aula-b1' });
  });

  it('outro erro ao criar a sala vira exceção com o motivo', async () => {
    const { provider } = api([{ status: 401, body: { info: 'authorization header missing' } }]);
    await expect(provider.createRoom({ bookingId: 'b1', startsAt: START, endsAt: END })).rejects.toThrow(/401.*authorization/);
  });

  it('acesso: token com o papel no user_id; professor é dono da sala; link no subdomínio da conta', async () => {
    const { calls, provider } = api([{ status: 200, body: { token: 'tok123' } }]);
    const r = await provider.issueAccess({ roomName: 'aula-b1', role: 'teacher', displayName: 'Ana', validFrom: START, validUntil: END });
    expect(r).toEqual({ joinUrl: 'https://reforce.daily.co/aula-b1?t=tok123' });
    const p = (calls[0]!.body as { properties: Record<string, unknown> }).properties;
    expect(p).toMatchObject({ room_name: 'aula-b1', user_name: 'Ana', is_owner: true });
    expect(String(p.user_id)).toMatch(/^teacher:/);
  });

  it('presença: assinatura conferida; entrada e saída viram eventos com o papel e a hora', () => {
    const { provider } = api([]);
    const joined = signed({ version: '1.0.0', type: 'participant.joined', id: 'ev1', payload: { room: 'aula-b1', user_id: 'student:x' }, event_ts: 1764608400.5 });
    expect(provider.parsePresenceWebhook(joined.headers, joined.raw)).toEqual([{
      eventId: 'ev1', roomName: 'aula-b1', role: 'student', kind: 'joined', at: Temporal.Instant.fromEpochMilliseconds(1764608400500),
    }]);
    const left = signed({ type: 'participant.left', id: 'ev2', payload: { room: 'aula-b1', user_id: 'teacher:y', duration: 3000 }, event_ts: 1764611400 });
    expect(provider.parsePresenceWebhook(left.headers, left.raw)[0]).toMatchObject({ role: 'teacher', kind: 'left' });
  });

  it('assinatura errada é recusada; o pedido de verificação do Daily não registra nada', () => {
    const { provider } = api([]);
    const ok = signed({ test: 'test' });
    expect(provider.parsePresenceWebhook(ok.headers, ok.raw)).toEqual([]);
    expect(() => provider.parsePresenceWebhook({ ...ok.headers, 'X-Webhook-Signature': 'AAAA' }, ok.raw)).toThrow(WebhookSignatureError);
    expect(() => provider.parsePresenceWebhook({}, ok.raw)).toThrow(WebhookSignatureError);
  });

  it('cadastra o webhook de presença só se ainda não existir', async () => {
    const url = 'https://reforce.app.br/api/webhooks/video';
    const a = api([{ status: 200, body: [] }, { status: 200, body: { uuid: 'w1' } }]);
    expect(await a.provider.ensureWebhook(url)).toBe('created');
    expect(a.calls[1]!.body).toEqual({ url, hmac: SECRET, eventTypes: ['participant.joined', 'participant.left'] });
    const b = api([{ status: 200, body: [{ url, state: 'ACTIVE' }] }]);
    expect(await b.provider.ensureWebhook(url)).toBe('exists');
  });
});

describe('configuração do vídeo', () => {
  const base = { DATABASE_URL: 'postgres://u:p@localhost:5433/aulas', APP_BASE_URL: 'http://localhost:3000', SESSION_SECRET: 's'.repeat(32), FILE_ENCRYPTION_KEY: 'a'.repeat(64) };
  it('VIDEO_PROVIDER=daily exige chave, subdomínio e segredo do webhook', () => {
    expect(() => loadConfig({ ...base, VIDEO_PROVIDER: 'daily' })).toThrow(/DAILY_API_KEY[\s\S]*DAILY_DOMAIN[\s\S]*DAILY_WEBHOOK_SECRET/);
    const c = loadConfig({ ...base, VIDEO_PROVIDER: 'daily', DAILY_API_KEY: 'chave-teste-123', DAILY_DOMAIN: 'reforce', DAILY_WEBHOOK_SECRET: SECRET });
    expect(c.daily).toEqual({ apiKey: 'chave-teste-123', domain: 'reforce', webhookSecret: SECRET });
  });
});
