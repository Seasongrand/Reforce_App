/** Carga inicial: catálogo fechado e equipe interna a partir de ADMIN_EMAILS. */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { seed } from '../../scripts/seed';
import { closeTestPool, testPool, truncateAll, TEST_DATABASE_URL } from '../helpers/db';

beforeEach(truncateAll);
afterAll(closeTestPool);

describe('db:seed', () => {
  it('semeia disciplinas, séries e equipe; rodar de novo não duplica', async () => {
    const admins = 'ops@exemplo.com, Ana Lima <ana@exemplo.com>';
    await seed(TEST_DATABASE_URL, { adminEmails: admins });
    await seed(TEST_DATABASE_URL, { adminEmails: admins });
    const { rows: s } = await testPool().query(`SELECT slug FROM subjects ORDER BY id`);
    // todas as disciplinas do catálogo (16 desde 27/11), em ordem de id
    expect(s.map((r) => r.slug)).toEqual([
      'matematica', 'fisica', 'quimica', 'redacao', 'lingua-portuguesa', 'literatura', 'biologia', 'ciencias',
      'historia', 'geografia', 'filosofia', 'sociologia', 'ingles', 'espanhol', 'arte', 'educacao-fisica',
    ]);
    const { rows: g } = await testPool().query(`SELECT count(*)::int AS n FROM grade_levels`);
    expect(g[0]!.n).toBe(8);
    const { rows: st } = await testPool().query(`SELECT email, name FROM staff_users ORDER BY email`);
    expect(st).toEqual([
      { email: 'ana@exemplo.com', name: 'Ana Lima' },
      { email: 'ops@exemplo.com', name: 'ops' },
    ]);
  });
});
