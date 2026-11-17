/**
 * Vitrine: a busca da §2.5 com os dados do cartão (endereço, foto, frase),
 * paginada, sem nota inventada para quem ainda não foi avaliado.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { refreshTeacher } from '@/domain/jobs';
import { PAGE_SIZE, searchTeachers } from '@/domain/search/teachers';
import { closeAppDb } from '../helpers/app';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { seedTestCatalog } from '../helpers/fixtures';
import { listedTeacher, NOW, testDeps, TUE_14 } from '../helpers/scenario';

beforeEach(async () => {
  await truncateAll();
  await seedTestCatalog(testPool());
});
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = () => testDeps();
const form = { subjectId: 1, gradeId: 9, modality: 'online' as const, cep: '', maxPriceCents: null, q: '', page: 1 };

/** Professor aprovado, que dá Matemática ao 9º ano, com o retrato da agenda pronto. */
async function searchable(i = 0) {
  const t = await listedTeacher();
  await testPool().query(
    `UPDATE teachers SET slug = $2, display_name = $3, headline = 'Matemática sem medo' WHERE id = $1`,
    [t.teacherId, `prof-${i}`, `Professora ${String(i).padStart(2, '0')}`],
  );
  await testPool().query(`INSERT INTO teacher_subjects (teacher_id, subject_id, grade_level_id) VALUES ($1, 1, 9)`, [t.teacherId]);
  await refreshTeacher(deps(), t.teacherId, NOW);
  return t;
}

describe('vitrine', () => {
  it('traz os dados do cartão, sem nota para quem ainda não foi avaliado', async () => {
    const t = await searchable();
    const r = await searchTeachers(deps(), form, NOW);
    if (!r.ok) throw new Error('esperava resultados');
    expect(r.hasMore).toBe(false);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({
      teacherId: t.teacherId, slug: 'prof-0', name: 'Professora 00', headline: 'Matemática sem medo',
      minPriceCents: 12100, nextSlot: TUE_14.toString(), rating: null, reviews: 0, km: null,
    });
    expect(r.items[0]!.photoUrl).toMatch(/^\/api\/fotos\/[0-9a-f-]{36}$/);
  });

  it('respeita o preço máximo e a série', async () => {
    await searchable();
    const cheap = await searchTeachers(deps(), { ...form, maxPriceCents: 10000 }, NOW);
    expect(cheap.ok && cheap.items).toEqual([]);
    const other = await searchTeachers(deps(), { ...form, gradeId: 6 }, NOW);
    expect(other.ok && other.items).toEqual([]);
  });

  it('aula presencial com CEP desconhecido avisa em vez de voltar vazio', async () => {
    await searchable();
    expect(await searchTeachers(deps(), { ...form, modality: 'at_student', cep: '99999999' }, NOW)).toEqual({ ok: false, error: 'cep' });
  });

  it('pagina de 12 em 12', async () => {
    for (let i = 0; i < PAGE_SIZE + 1; i++) await searchable(i);
    const p1 = await searchTeachers(deps(), form, NOW);
    const p2 = await searchTeachers(deps(), { ...form, page: 2 }, NOW);
    if (!p1.ok || !p2.ok) throw new Error('esperava resultados');
    expect(p1.items).toHaveLength(PAGE_SIZE);
    expect(p1.hasMore).toBe(true);
    expect(p2.items).toHaveLength(1);
    expect(p2.hasMore).toBe(false);
    expect(new Set([...p1.items, ...p2.items].map((x) => x.teacherId)).size).toBe(PAGE_SIZE + 1);
  });
});
