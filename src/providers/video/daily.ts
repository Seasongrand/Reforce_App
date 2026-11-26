/**
 * Sala de vídeo pelo Daily (§3.6). Cada aula online tem uma sala privada, que
 * só abre de 10 minutos antes a 30 minutos depois da aula; cada participante
 * entra com um token próprio, que leva o papel (professor ou aluno) no user_id.
 * A presença chega por webhook, assinado com HMAC-SHA256: base64 do HMAC, com
 * o segredo decodificado de base64, sobre "<X-Webhook-Timestamp>.<corpo>".
 * Chave e segredo só em variáveis de ambiente.
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Temporal } from 'temporal-polyfill';
import { WebhookSignatureError } from '../errors';
import { header, type HeaderBag } from '../signing';
import type { ParticipantRole, PresenceEvent, VideoProvider } from './types';

const API = 'https://api.daily.co/v1';
export const DAILY_OPENS_BEFORE_MIN = 10;
export const DAILY_CLOSES_AFTER_MIN = 30;
const ROLES: ParticipantRole[] = ['teacher', 'student', 'observer'];
const secs = (i: Temporal.Instant) => Math.floor(i.epochMilliseconds / 1000);

export interface DailyOptions {
  apiKey: string;
  /** Subdomínio da conta: "reforce" para reforce.daily.co. */
  domain: string;
  /** Segredo do webhook, em base64 (o mesmo cadastrado no Daily). */
  webhookSecret: string;
  fetch?: typeof fetch;
}

export class DailyVideoProvider implements VideoProvider {
  readonly name = 'daily';
  constructor(private readonly opts: DailyOptions) {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
    const res = await (this.opts.fetch ?? fetch)(`${API}${path}`, {
      method,
      headers: { authorization: `Bearer ${this.opts.apiKey}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, data };
  }

  async createRoom(input: { bookingId: string; startsAt: Temporal.Instant; endsAt: Temporal.Instant }) {
    const name = `aula-${input.bookingId}`;
    const r = await this.call<{ name?: string; info?: string; error?: string }>('POST', '/rooms', {
      name,
      privacy: 'private',
      properties: {
        nbf: secs(input.startsAt.subtract({ minutes: DAILY_OPENS_BEFORE_MIN })),
        exp: secs(input.endsAt.add({ minutes: DAILY_CLOSES_AFTER_MIN })),
        eject_at_room_exp: true,
        lang: 'pt-BR',
      },
    });
    // tarefa repetida: a sala já existe e serve do mesmo jeito
    if (r.status >= 400 && !/already exists/i.test(r.data.info ?? '')) {
      throw new Error(`Daily recusou a sala (${r.status}): ${r.data.info ?? r.data.error ?? 'sem detalhe'}`);
    }
    return { roomName: name };
  }

  async issueAccess(input: {
    roomName: string; role: ParticipantRole; displayName: string; validFrom: Temporal.Instant; validUntil: Temporal.Instant;
  }) {
    const r = await this.call<{ token?: string; info?: string }>('POST', '/meeting-tokens', {
      properties: {
        room_name: input.roomName,
        user_name: input.displayName,
        user_id: `${input.role}:${randomUUID()}`,
        is_owner: input.role === 'teacher',
        nbf: secs(input.validFrom),
        exp: secs(input.validUntil),
        lang: 'pt-BR',
      },
    });
    if (r.status >= 400 || !r.data.token) throw new Error(`Daily recusou o acesso (${r.status}): ${r.data.info ?? 'sem detalhe'}`);
    return { joinUrl: `https://${this.opts.domain}.daily.co/${encodeURIComponent(input.roomName)}?t=${r.data.token}` };
  }

  parsePresenceWebhook(headers: HeaderBag, rawBody: string): PresenceEvent[] {
    const ts = header(headers, 'x-webhook-timestamp');
    const sig = header(headers, 'x-webhook-signature');
    if (!ts || !sig) throw new WebhookSignatureError();
    const expected = createHmac('sha256', Buffer.from(this.opts.webhookSecret, 'base64')).update(`${ts}.${rawBody}`).digest();
    const got = Buffer.from(sig, 'base64');
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) throw new WebhookSignatureError();

    const b = JSON.parse(rawBody) as {
      id?: string; type?: string; event_ts?: number; payload?: { room?: string; user_id?: string };
    };
    // o Daily também manda o pedido de verificação do webhook e outros eventos: nada a registrar
    if ((b.type !== 'participant.joined' && b.type !== 'participant.left') || !b.id || !b.payload?.room || !b.event_ts) return [];
    const prefix = (b.payload.user_id ?? '').split(':')[0] as ParticipantRole;
    return [{
      eventId: b.id,
      roomName: b.payload.room,
      role: ROLES.includes(prefix) ? prefix : 'observer',
      kind: b.type === 'participant.joined' ? 'joined' : 'left',
      at: Temporal.Instant.fromEpochMilliseconds(Math.round(b.event_ts * 1000)),
    }];
  }

  /** Cadastra no Daily o webhook de presença deste site, se ainda não existir (idempotente). */
  async ensureWebhook(url: string): Promise<'exists' | 'created'> {
    const list = await this.call<Array<{ url?: string; state?: string }> | { data?: Array<{ url?: string }> }>('GET', '/webhooks');
    const hooks = Array.isArray(list.data) ? list.data : (list.data.data ?? []);
    if (hooks.some((h) => h.url === url)) return 'exists';
    const r = await this.call<{ uuid?: string; info?: string; error?: string }>('POST', '/webhooks', {
      url,
      hmac: this.opts.webhookSecret,
      eventTypes: ['participant.joined', 'participant.left'],
    });
    if (r.status >= 400) throw new Error(`Daily recusou o webhook (${r.status}): ${r.data.info ?? r.data.error ?? 'sem detalhe'}`);
    return 'created';
  }
}
