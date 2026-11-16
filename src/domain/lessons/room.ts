/**
 * Entrada na sala de vídeo da aula (§3.6): só aula online paga, de 10 minutos
 * antes do início a 30 minutos depois do fim, com acesso emitido por
 * participante. Quem pode pedir (professor dono da aula ou família com o
 * link assinado) é verificado na rota.
 */
import type { Temporal } from 'temporal-polyfill';
import type { ParticipantRole } from '@/providers/video/types';
import { instantFromDb } from '@/time/zoned';
import { createVideoRoom } from '../jobs';
import type { Deps } from '../deps';
import { DomainError } from '../errors';

export const ROOM_OPENS_BEFORE_MIN = 10;
export const ROOM_CLOSES_AFTER_MIN = 30;

export async function joinRoom(
  deps: Deps,
  input: { bookingId: string; role: ParticipantRole; displayName: string },
  now: Temporal.Instant,
): Promise<{ joinUrl: string }> {
  const b = await deps.db.selectFrom('bookings').select(['starts_at', 'ends_at', 'modality', 'status'])
    .where('id', '=', input.bookingId).executeTakeFirst();
  if (!b || b.status !== 'confirmed') throw new DomainError('not_found', 'aula não encontrada ou não confirmada');
  if (b.modality !== 'online') throw new DomainError('invalid', 'esta aula não é online');
  const opens = instantFromDb(b.starts_at).subtract({ minutes: ROOM_OPENS_BEFORE_MIN });
  const closes = instantFromDb(b.ends_at).add({ minutes: ROOM_CLOSES_AFTER_MIN });
  if (now.epochMilliseconds < opens.epochMilliseconds) {
    throw new DomainError('conflict', `a sala abre ${ROOM_OPENS_BEFORE_MIN} minutos antes da aula`);
  }
  if (now.epochMilliseconds > closes.epochMilliseconds) throw new DomainError('conflict', 'a aula já foi encerrada');

  await createVideoRoom(deps, input.bookingId, now); // caso a tarefa ainda não tenha rodado
  const ls = await deps.db.selectFrom('lesson_sessions').select('video_room')
    .where('booking_id', '=', input.bookingId).executeTakeFirstOrThrow();
  return deps.providers.video.issueAccess({
    roomName: ls.video_room!,
    role: input.role,
    displayName: input.displayName,
    validFrom: opens,
    validUntil: closes,
  });
}
