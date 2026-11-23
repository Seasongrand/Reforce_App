/**
 * Apêndice §2.5: busca, nota bayesiana, texto sem acento, distância e retrato
 * do próximo horário. Só SQL: a tela de busca é da Fase 2.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { SEARCH_SQL, type SearchParams, searchParams } from '@/domain/search/sql';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import {
  insertBooking,
  insertFamilyOrder,
  insertListedTeacher,
  northOf,
  pgErrorCode,
  seedTestCatalog,
  sp,
} from '../helpers/fixtures';

const db = () => testPool();
const NOW = '2026-11-16 08:00-03';

beforeEach(async () => {
  await truncateAll();
  await seedTestCatalog(db());
});
afterAll(closeTestPool);

const refreshSlots = (teacherId: string, now = NOW) =>
  db().query(`SELECT refresh_next_slot($1, $2::timestamptz)`, [teacherId, now]);

type Row = { teacher_id: string; display_name: string; nota: string; km: string | null; next_slot_at: Date };

async function search(p: Partial<SearchParams>): Promise<Row[]> {
  const { rows } = await db().query<Row>(
    SEARCH_SQL,
    searchParams({ subject: 1, grade: 9, modality: 'online', maxPriceCents: 50000, q: '', now: NOW, ...p }),
  );
  return rows;
}

describe('busca por disciplina, série, modalidade e preço', () => {
  it('volta os 3 professores da disciplina; na aula online a certidão vencida não tira da busca', async () => {
    const a = await insertListedTeacher(db(), { name: 'Ana' });
    const b = await insertListedTeacher(db(), { name: 'Bruno' });
    const c = await insertListedTeacher(db(), { name: 'Carla', criminalRecordExpired: true });
    const d = await insertListedTeacher(db(), { name: 'Davi', subjects: [[2, 9]] });
    for (const t of [a, b, c, d]) await refreshSlots(t.teacherId);
    const rows = await search({});
    expect(rows.map((r) => r.display_name).sort()).toEqual(['Ana', 'Bruno', 'Carla']);
  });

  it('na aula presencial, a professora com certidão vencida fica fora', async () => {
    const a = await insertListedTeacher(db(), { name: 'Ana', modality: 'at_teacher', lat: -23.56, lng: -46.65 });
    const c = await insertListedTeacher(db(), { name: 'Carla', modality: 'at_teacher', lat: -23.56, lng: -46.65, criminalRecordExpired: true });
    for (const t of [a, c]) await refreshSlots(t.teacherId);
    const rows = await search({ modality: 'at_teacher', lat: -23.56, lng: -46.65, familyRadiusKm: 10 });
    expect(rows.map((r) => r.display_name)).toEqual(['Ana']);
  });

  it('respeita o preço máximo', async () => {
    const a = await insertListedTeacher(db(), { name: 'Ana', priceCents: 15000 });
    await refreshSlots(a.teacherId);
    expect(await search({ maxPriceCents: 14999 })).toEqual([]);
    expect(await search({ maxPriceCents: 15000 })).toHaveLength(1);
  });
});

describe('ordenação por média bayesiana', () => {
  it('40 avaliações de média 4,8 (4,77) ficam à frente de 1 avaliação nota 5 (4,58)', async () => {
    const many = await insertListedTeacher(db(), { name: 'Muitas' });
    const one = await insertListedTeacher(db(), { name: 'Uma' });
    for (const t of [many, one]) await refreshSlots(t.teacherId);
    await db().query(`UPDATE teacher_search SET rating_sum = 192, rating_count = 40 WHERE teacher_id = $1`, [
      many.teacherId,
    ]);
    await db().query(`UPDATE teacher_search SET rating_sum = 5, rating_count = 1 WHERE teacher_id = $1`, [one.teacherId]);
    const rows = await search({});
    expect(rows.map((r) => [r.display_name, r.nota])).toEqual([
      ['Muitas', '4.77'],
      ['Uma', '4.58'],
    ]);
  });
});

describe('texto livre sem acento', () => {
  it('"recuperacao" encontra "Recuperação"', async () => {
    const t = await insertListedTeacher(db(), { name: 'Ana', bio: 'Aulas de Recuperação e reforço para o ENEM' });
    await refreshSlots(t.teacherId);
    expect((await search({ q: 'recuperacao' })).map((r) => r.display_name)).toEqual(['Ana']);
    expect(await search({ q: 'geometria' })).toEqual([]);
  });

  it('o nome da disciplina entra no texto', async () => {
    const t = await insertListedTeacher(db(), { name: 'Ana' });
    await refreshSlots(t.teacherId);
    expect(await search({ q: 'matematica' })).toHaveLength(1);
  });
});

describe('distância na aula na casa do aluno', () => {
  const famLat = -23.55;
  const famLng = -46.63;

  it('raio do professor de 5 km: a 2,9 km aparece; a 10,1 km não; com raio de 12 km, aparece', async () => {
    const near = await insertListedTeacher(db(), {
      name: 'Perto', modality: 'at_student', lat: northOf(famLat, 2.9), lng: famLng, radiusKm: 5,
    });
    const far = await insertListedTeacher(db(), {
      name: 'Longe', modality: 'at_student', lat: northOf(famLat, 10.1), lng: famLng, radiusKm: 5,
    });
    for (const t of [near, far]) await refreshSlots(t.teacherId);
    const params = { modality: 'at_student' as const, lat: famLat, lng: famLng, familyRadiusKm: 10 };

    const first = await search(params);
    expect(first.map((r) => [r.display_name, r.km])).toEqual([['Perto', '2.9']]);

    await db().query(`UPDATE teachers SET travel_radius_km = 12 WHERE id = $1`, [far.teacherId]);
    await db().query(`SELECT refresh_teacher_search($1)`, [far.teacherId]);
    const second = await search(params);
    expect(second.map((r) => [r.display_name, r.km]).sort()).toEqual([
      ['Longe', '10.1'],
      ['Perto', '2.9'],
    ]);
  });
});

describe('retrato do próximo horário', () => {
  it('desatualizado: a reserva pelo retrato velho é recusada com 23P01; refeito, passa de 14h para 15h30', async () => {
    const t = await insertListedTeacher(db(), { name: 'Ana', bufferAfterMin: 10 });
    await refreshSlots(t.teacherId);
    const snapshot = async () =>
      (await db().query<{ next_slot_at: Date }>(
        `SELECT next_slot_at FROM teacher_next_slot WHERE teacher_id = $1 AND modality = 'online'`,
        [t.teacherId],
      )).rows[0]!.next_slot_at.toISOString();
    expect(await snapshot()).toBe(sp('2026-11-17 14:00'));

    const sell = async () => {
      const fam = await insertFamilyOrder(db(), t.teacherId, t.serviceId);
      return insertBooking(db(), {
        ...fam, teacherId: t.teacherId, serviceId: t.serviceId, startsAt: '2026-11-17 14:00-03', bufferAfterMin: 10,
      });
    };
    await sell();
    expect(await snapshot()).toBe(sp('2026-11-17 14:00')); // retrato ainda velho
    expect(await pgErrorCode(sell())).toBe('23P01');

    await refreshSlots(t.teacherId);
    expect(await snapshot()).toBe(sp('2026-11-17 15:30'));
  });

  it('conta os horários livres nos próximos 7 dias e guarda o menor preço da modalidade', async () => {
    const t = await insertListedTeacher(db(), { name: 'Ana', priceCents: 9000 });
    await refreshSlots(t.teacherId);
    const { rows } = await db().query(
      `SELECT min_price_cents, slots_7d FROM teacher_next_slot WHERE teacher_id = $1 AND modality = 'online'`,
      [t.teacherId],
    );
    // terça 17/11, 14h–18h, aula de 60 min em grade de 30: 7 horários
    expect(rows[0]).toEqual({ min_price_cents: 9000, slots_7d: 7 });
  });

  it('às 22h em São Paulo (dia seguinte em UTC) ainda enxerga os horários da noite do dia local', async () => {
    const t = await insertListedTeacher(db(), { name: 'Ana' });
    await db().query(`UPDATE teachers SET min_notice_min = 0 WHERE id = $1`, [t.teacherId]);
    await db().query(
      `INSERT INTO availability_rules (teacher_id, weekday, start_local, end_local) VALUES ($1, 1, '22:00', '23:30')`,
      [t.teacherId],
    );
    // segunda 16/11 às 22h em São Paulo = terça 17/11 01:00 UTC
    await refreshSlots(t.teacherId, '2026-11-16 22:00-03');
    const { rows } = await db().query<{ next_slot_at: Date }>(
      `SELECT next_slot_at FROM teacher_next_slot WHERE teacher_id = $1`,
      [t.teacherId],
    );
    expect(rows[0]!.next_slot_at.toISOString()).toBe(sp('2026-11-16 22:00'));
  });
});
