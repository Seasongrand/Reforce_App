/**
 * Séries que a reserva oferece e qual vem marcada: as do professor para a
 * disciplina da aula; a da busca, se ele atende; a única, se só houver uma;
 * senão, a família escolhe (nada marcado).
 */
import { describe, expect, it } from 'vitest';
import { bookingGrades } from '@/domain/public/booking-grades';
import { GRADE_LEVELS } from '@/domain/catalog';

const teaches = [
  { subject: 'Matemática', grades: ['8º ano', '9º ano'] },
  { subject: 'Física', grades: ['1ª série do ensino médio'] },
];

describe('séries da reserva', () => {
  it('só uma série para a disciplina: vem marcada', () => {
    expect(bookingGrades({ teaches, subject: 'Física' })).toEqual({
      grades: [{ slug: '1serie', name: '1ª série do ensino médio' }],
      selected: '1serie',
    });
  });

  it('várias séries: oferece só as do professor, na ordem do catálogo, e marca a da busca', () => {
    const r = bookingGrades({ teaches: [{ subject: 'Matemática', grades: ['9º ano', '8º ano'] }], subject: 'Matemática', wanted: '9ano' });
    expect(r.grades.map((g) => g.slug)).toEqual(['8ano', '9ano']);
    expect(r.selected).toBe('9ano');
  });

  it('série da busca que o professor não atende, ou nenhuma: a família escolhe', () => {
    expect(bookingGrades({ teaches, subject: 'Matemática', wanted: '6ano' }).selected).toBe('');
    expect(bookingGrades({ teaches, subject: 'Matemática', wanted: null }).selected).toBe('');
    expect(bookingGrades({ teaches, subject: 'Matemática', wanted: 'qualquer' }).selected).toBe('');
  });

  it('disciplina sem séries cadastradas: todas as do catálogo, com a da busca marcada se houver', () => {
    const r = bookingGrades({ teaches, subject: 'Química' });
    expect(r.grades).toEqual(GRADE_LEVELS.map((g) => ({ slug: g.slug, name: g.name })));
    expect(r.selected).toBe('');
    expect(bookingGrades({ teaches, subject: 'Química', wanted: '9ano' }).selected).toBe('9ano');
  });
});
