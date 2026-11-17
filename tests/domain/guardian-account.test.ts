/**
 * Minha conta (do adulto responsável, sem senha): entrada por código no
 * e-mail, aulas próximas e anteriores, avaliação depois da aula concluída e
 * as estrelas no perfil e na vitrine.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { finishGuardianLogin, startGuardianLogin } from '@/domain/auth/guardian';
import { accountView } from '@/domain/guardians/account';
import { refreshTeacher } from '@/domain/jobs';
import { publicTeacherPage } from '@/domain/public/teacher-page';
import { maskContacts, submitReview } from '@/domain/reviews';
import { searchTeachers } from '@/domain/search/teachers';
import { closeAppDb } from '../helpers/app';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { seedTestCatalog } from '../helpers/fixtures';
import { family, NOW, paidLesson, testDeps, TUE_14 } from '../helpers/scenario';

beforeEach(async () => {
  await truncateAll();
  await seedTestCatalog(testPool());
});
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = () => testDeps();
const q = async (text: string, params: unknown[] = []) => (await testPool().query(text, params)).rows;
const AFTER = TUE_14.add({ hours: 3 });

async function lastCodeFor(email: string): Promise<string> {
  const rows = await q(`SELECT body FROM dev_outbox WHERE recipient = $1 ORDER BY id DESC LIMIT 1`, [email]);
  return /(\d{6})/.exec(rows[0]!.body as string)![1]!;
}

/** Aula paga e concluída (o desfecho da aula já foi registrado). */
async function completedLesson() {
  const l = await paidLesson();
  await q(`UPDATE bookings SET status = 'completed' WHERE id = $1`, [l.bookingId]);
  await q(`UPDATE guardians SET name = 'Maria Lima' WHERE id = $1`, [l.guardianId]);
  return l;
}

describe('entrada na conta', () => {
  it('o responsável entra com o código do e-mail', async () => {
    const f = await family();
    const email = (await q(`SELECT email FROM guardians WHERE id = $1`, [f.guardianId]))[0]!.email as string;
    const start = await startGuardianLogin(deps(), email.toUpperCase(), NOW);
    expect(start.sentTo).toMatch(/\*\*\*/);
    const r = await finishGuardianLogin(deps(), { codeId: start.codeId, code: await lastCodeFor(email) }, NOW);
    expect(r).toMatchObject({ ok: true, guardianId: f.guardianId });
  });

  it('e-mail sem conta não recebe nada e não denuncia que não existe', async () => {
    const start = await startGuardianLogin(deps(), 'ninguem@exemplo.com', NOW);
    expect(start.sentTo).toMatch(/\*\*\*/);
    expect(await q(`SELECT 1 FROM dev_outbox WHERE recipient = 'ninguem@exemplo.com'`)).toEqual([]);
    expect(await finishGuardianLogin(deps(), { codeId: start.codeId, code: '000000' }, NOW)).toMatchObject({ ok: false });
  });
});

describe('minhas aulas', () => {
  it('separa próximas e anteriores; só a concluída pode ser avaliada', async () => {
    const l = await paidLesson();
    let v = await accountView(deps(), l.guardianId, NOW);
    expect(v.upcoming).toHaveLength(1);
    expect(v.upcoming[0]).toMatchObject({ bookingId: l.bookingId, subject: 'Matemática', canReview: false });
    expect(v.upcoming[0]!.lessonUrl).toMatch(/\/aula\//);
    expect(v.upcoming[0]!.teacherPhotoUrl).toMatch(/^\/api\/fotos\//);
    expect(v.past).toEqual([]);
    expect(v.students).toEqual([{ firstName: 'Joana', grade: '9º ano' }]);
    await q(`UPDATE bookings SET status = 'completed' WHERE id = $1`, [l.bookingId]);
    v = await accountView(deps(), l.guardianId, AFTER);
    expect(v.upcoming).toEqual([]);
    expect(v.past[0]).toMatchObject({ bookingId: l.bookingId, canReview: true, review: null });
  });
});

describe('avaliação', () => {
  it('uma por aula concluída, do próprio responsável, com nota de 1 a 5', async () => {
    const l = await completedLesson();
    const other = await family();
    const base = { guardianId: l.guardianId, bookingId: l.bookingId, rating: 5, comment: 'Explica muito bem.' };
    await expect(submitReview(deps(), { ...base, guardianId: other.guardianId }, AFTER)).rejects.toThrow(/não encontrada/);
    await expect(submitReview(deps(), { ...base, rating: 6 }, AFTER)).rejects.toThrow(/de 1 a 5/);
    await expect(submitReview(deps(), base, TUE_14.add({ hours: 31 * 24 }))).rejects.toThrow(/30 dias/);
    await submitReview(deps(), base, AFTER);
    await expect(submitReview(deps(), base, AFTER)).rejects.toThrow(/já foi avaliada/);
    const v = await accountView(deps(), l.guardianId, AFTER);
    expect(v.past[0]).toMatchObject({ canReview: false, review: { rating: 5, comment: 'Explica muito bem.' } });
  });

  it('aula que não foi concluída não pode ser avaliada', async () => {
    const l = await paidLesson();
    await expect(submitReview(deps(), { guardianId: l.guardianId, bookingId: l.bookingId, rating: 4, comment: '' }, AFTER))
      .rejects.toThrow(/depois da aula/);
  });

  it('esconde telefone e e-mail digitados no comentário', () => {
    expect(maskContacts('Me chama no (11) 98888-7777 ou ana.prof@gmail.com, valeu'))
      .toBe('Me chama no [contato removido] ou [contato removido], valeu');
    expect(maskContacts('Nota 10, aula de 60 minutos em 2026')).toBe('Nota 10, aula de 60 minutos em 2026');
  });

  it('a nota aparece no perfil e na vitrine com a média real', async () => {
    const l = await completedLesson();
    await submitReview(deps(), { guardianId: l.guardianId, bookingId: l.bookingId, rating: 4, comment: 'Boa aula, ligue 11 98888-7777' }, AFTER);
    await testPool().query(`INSERT INTO teacher_subjects (teacher_id, subject_id, grade_level_id) VALUES ($1, 1, 9) ON CONFLICT DO NOTHING`, [l.teacherId]);
    await refreshTeacher(deps(), l.teacherId, AFTER);
    const slug = (await q(`SELECT slug FROM teachers WHERE id = $1`, [l.teacherId]))[0]!.slug as string;
    const page = await publicTeacherPage(deps(), slug, AFTER);
    expect(page!.rating).toEqual({ average: 4, count: 1 });
    expect(page!.reviews).toEqual([
      { rating: 4, comment: 'Boa aula, ligue [contato removido]', author: 'Maria L.', date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
    ]);
    expect(JSON.stringify(page)).not.toContain('Joana');
    const s = await searchTeachers(deps(), { subjectId: 1, gradeId: 9, modality: 'online', cep: '', maxPriceCents: null, q: '', page: 1 },
      Temporal.Instant.from(AFTER.toString()));
    if (!s.ok) throw new Error('esperava resultados');
    const item = s.items.find((i) => i.teacherId === l.teacherId);
    expect(item).toMatchObject({ rating: 4, reviews: 1 });
  });
});
