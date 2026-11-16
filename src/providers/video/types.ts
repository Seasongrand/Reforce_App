import type { Temporal } from 'temporal-polyfill';
import type { HeaderBag } from '../signing';

export type ParticipantRole = 'teacher' | 'student' | 'observer';

export interface PresenceEvent {
  eventId: string;
  roomName: string;
  role: ParticipantRole;
  kind: 'joined' | 'left';
  at: Temporal.Instant;
}

/** Sala de vídeo embutida (§3.6): criar sala, emitir acesso, receber presença. */
export interface VideoProvider {
  readonly name: string;
  createRoom(input: { bookingId: string; startsAt: Temporal.Instant; endsAt: Temporal.Instant }): Promise<{ roomName: string }>;
  issueAccess(input: {
    roomName: string;
    role: ParticipantRole;
    displayName: string;
    validFrom: Temporal.Instant;
    validUntil: Temporal.Instant;
  }): Promise<{ joinUrl: string }>;
  parsePresenceWebhook(headers: HeaderBag, rawBody: string): PresenceEvent[];
}
