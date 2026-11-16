import { randomUUID } from 'node:crypto';
import { Temporal } from 'temporal-polyfill';
import type { Db } from '@/db/client';
import { recordCall } from '../dev-log';
import { WebhookSignatureError } from '../errors';
import { hmacHex, header, safeEqualHex, type HeaderBag } from '../signing';
import type { ParticipantRole, PresenceEvent, VideoProvider } from './types';

const SIG = 'x-fake-signature';

/** Sala falsa em /dev/sala/<sala>: botões "entrar" e "sair" disparam webhooks de presença. */
export class FakeVideoProvider implements VideoProvider {
  readonly name = 'fake';

  constructor(private readonly db: Db, private readonly opts: { webhookSecret: string; appBaseUrl: string }) {}

  async createRoom(input: { bookingId: string; startsAt: Temporal.Instant; endsAt: Temporal.Instant }) {
    const roomName = `fake-room-${input.bookingId}`;
    await recordCall(this.db, this.name, 'createRoom', roomName, { bookingId: input.bookingId });
    return { roomName };
  }

  async issueAccess(input: {
    roomName: string; role: ParticipantRole; displayName: string; validFrom: Temporal.Instant; validUntil: Temporal.Instant;
  }) {
    const until = input.validUntil.toString();
    const token = this.accessToken(input.roomName, input.role, until);
    const q = new URLSearchParams({ role: input.role, name: input.displayName, until, token });
    return { joinUrl: `${this.opts.appBaseUrl}/dev/sala/${encodeURIComponent(input.roomName)}?${q}` };
  }

  accessToken(roomName: string, role: string, until: string): string {
    return hmacHex(this.opts.webhookSecret, `access|${roomName}|${role}|${until}`);
  }

  parsePresenceWebhook(headers: HeaderBag, rawBody: string): PresenceEvent[] {
    const sig = header(headers, SIG);
    if (!sig || !safeEqualHex(sig, hmacHex(this.opts.webhookSecret, rawBody))) throw new WebhookSignatureError();
    const b = JSON.parse(rawBody) as { id: string; room: string; role: ParticipantRole; kind: 'joined' | 'left'; at: string };
    return [{ eventId: b.id, roomName: b.room, role: b.role, kind: b.kind, at: Temporal.Instant.from(b.at) }];
  }

  simulatePresence(roomName: string, role: ParticipantRole, kind: 'joined' | 'left', at: Temporal.Instant, eventId: string = randomUUID()) {
    const body = JSON.stringify({ id: eventId, room: roomName, role, kind, at: at.toString() });
    return { headers: { [SIG]: hmacHex(this.opts.webhookSecret, body) }, body };
  }
}
