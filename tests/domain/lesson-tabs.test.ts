/** Aulas do professor em duas abas: Próximas (a mais perto primeiro) e Anteriores (a mais recente primeiro). */
import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';
import { splitLessons, type TeacherLesson } from '@/domain/teachers/lessons';

const NOW = Temporal.Instant.from('2026-11-16T14:00:00Z');

function lesson(id: string, starts: string, status = 'confirmed', minutes = 60): TeacherLesson {
  const startsAt = Temporal.Instant.from(starts);
  return {
    bookingId: id, startsAt, endsAt: startsAt.add({ minutes }), status, modality: 'online', subject: 'Matemática',
    studentFirstName: 'Aluno', studentGrade: '9º ano', address: null, checkedIn: false, outcome: null,
    refundableUntil: null, refundCents: null, refunded: false, weekly: false, dispute: null,
  };
}

describe('aulas em abas', () => {
  it('próximas: confirmadas que não terminaram, a mais perto primeiro; aula em andamento continua em próximas', () => {
    const { upcoming } = splitLessons([
      lesson('depois', '2026-11-20T14:00:00Z'),
      lesson('agora', '2026-11-16T13:30:00Z'),
      lesson('amanha', '2026-11-17T14:00:00Z'),
    ], NOW);
    expect(upcoming.map((l) => l.bookingId)).toEqual(['agora', 'amanha', 'depois']);
  });

  it('anteriores: concluída, falta, cancelada e confirmada que já terminou, a mais recente primeiro', () => {
    const { upcoming, past } = splitLessons([
      lesson('concluida', '2026-11-10T14:00:00Z', 'completed'),
      lesson('terminou', '2026-11-16T12:00:00Z'),
      lesson('falta', '2026-11-12T14:00:00Z', 'no_show'),
      lesson('cancelada-futura', '2026-11-25T14:00:00Z', 'cancelled'),
      lesson('fim-agora', '2026-11-16T13:00:00Z'),
    ], NOW);
    expect(upcoming).toEqual([]);
    expect(past.map((l) => l.bookingId)).toEqual(['cancelada-futura', 'fim-agora', 'terminou', 'falta', 'concluida']);
  });

  it('sem aulas: as duas abas vazias', () => {
    expect(splitLessons([], NOW)).toEqual({ upcoming: [], past: [] });
  });
});
