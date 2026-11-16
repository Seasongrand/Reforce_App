/**
 * Apêndice: "2.000 professores sintéticos — busca em cerca de 6 ms; 2.000
 * retratos refeitos em 1,3 s". Os números dependem da máquina; os limites
 * aqui são folgados e o teste imprime o que mediu. Rode com `npm run test:perf`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEARCH_SQL, searchParams } from '@/domain/search/sql';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { seedTestCatalog } from '../helpers/fixtures';

const db = () => testPool();
const NOW = '2026-11-16 08:00-03';
const N = 2000;

beforeAll(async () => {
  await truncateAll();
  await seedTestCatalog(db());
  await db().query(
    `INSERT INTO teachers (slug, display_name, status, bio, base_lat, base_lng, travel_radius_km)
     SELECT 'sintetico-' || g, 'Professor ' || g, 'approved', 'Aulas de reforço e recuperação',
            -23.55 + (g % 97) * 0.003, -46.63 + (g % 89) * 0.003, 5 + g % 10
       FROM generate_series(1, $1) g`,
    [N],
  );
  await db().query(`INSERT INTO teacher_verifications (teacher_id, kind, status, decided_at, valid_until)
    SELECT t.id, k, 'approved', now(), CASE WHEN k = 'criminal_record' THEN current_date + 180 END
      FROM teachers t, unnest(ARRAY['identity','criminal_record','education']) k`);
  await db().query(`INSERT INTO teacher_subjects (teacher_id, subject_id, grade_level_id)
    SELECT t.id, s, g FROM teachers t, (VALUES (1), (2)) x(s), (VALUES (9), (10)) y(g)`);
  await db().query(`INSERT INTO services (teacher_id, subject, subject_id, duration_min, price_cents, modality)
    SELECT t.id, 'matematica', 1, 60, 8000 + (abs(hashtext(t.slug)) % 80) * 100, m
      FROM teachers t, unnest(ARRAY['online','at_student']) m`);
  await db().query(`INSERT INTO availability_rules (teacher_id, weekday, start_local, end_local)
    SELECT t.id, d, '14:00', '18:00' FROM teachers t, (VALUES (2), (4)) x(d)`);
  await db().query(`SELECT refresh_teacher_search(id) FROM teachers`);
}, 300_000);

afterAll(closeTestPool);

describe('volume: 2.000 professores', () => {
  it('refaz os 2.000 retratos em menos de 10 s', async () => {
    const t0 = performance.now();
    await db().query(`SELECT refresh_next_slot(id, $1::timestamptz) FROM teachers`, [NOW]);
    const ms = performance.now() - t0;
    await db().query('ANALYZE');
    console.info(`[perf] ${N} retratos refeitos em ${(ms / 1000).toFixed(2)} s`);
    expect(ms).toBeLessThan(10_000);
  }, 120_000);

  it('busca em menos de 50 ms (mediana de 20)', async () => {
    const params = searchParams({ subject: 1, grade: 9, modality: 'online', maxPriceCents: 20000, q: '', now: NOW });
    const times: number[] = [];
    let count = 0;
    for (let i = 0; i < 21; i++) {
      const t0 = performance.now();
      const { rowCount } = await db().query(SEARCH_SQL, params);
      if (i > 0) times.push(performance.now() - t0); // a primeira aquece o cache
      count = rowCount ?? 0;
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)]!;
    console.info(`[perf] busca: ${count} professores, mediana ${median.toFixed(1)} ms`);
    expect(count).toBe(N);
    expect(median).toBeLessThan(50);
  });
});
