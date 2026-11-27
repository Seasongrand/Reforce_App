/**
 * Catálogo de disciplinas (decisão do dono, 27/11): a Reforce abre com todas as
 * disciplinas da lista de espera, com os mesmos ids, para que quem se inscreveu
 * em qualquer uma delas possa dar aula.
 */
import { describe, expect, it } from 'vitest';
import { SUBJECTS, subjectName } from '@/domain/catalog';
import { WAITLIST_SUBJECTS } from '@/domain/waitlist';

describe('catálogo de disciplinas', () => {
  it('tem todas as disciplinas da lista de espera, com os mesmos ids e nomes', () => {
    const catalog = new Map(SUBJECTS.map((s) => [s.id, s.name]));
    expect(SUBJECTS).toHaveLength(WAITLIST_SUBJECTS.length);
    for (const w of WAITLIST_SUBJECTS) expect(catalog.get(w.id)).toBe(w.name);
    expect(subjectName('historia')).toBe('História');
  });

  it('ids e slugs são únicos, e os slugs só têm letras minúsculas sem acento e hífen', () => {
    expect(new Set(SUBJECTS.map((s) => s.id)).size).toBe(SUBJECTS.length);
    expect(new Set(SUBJECTS.map((s) => s.slug)).size).toBe(SUBJECTS.length);
    for (const s of SUBJECTS) expect(s.slug).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });
});
