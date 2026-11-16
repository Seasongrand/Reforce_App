/**
 * Agenda do professor (§1, professor, passo 5; §2.3): regras semanais,
 * exceções por data, ajustes e serviços por modalidade com deslocamento.
 * Toda mudança vale na hora para os horários livres e não altera aula vendida.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  addOverride, addRule, connectCalendar, createService, removeRule, updateScheduleSettings, updateService,
} from '@/domain/teachers/schedule';
import { availableSlots } from '@/domain/availability';
import { closeAppDb } from '../helpers/app';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { insertBooking, insertFamilyOrder, insertTeacher, seedTestCatalog, sp } from '../helpers/fixtures';
import { NOW, testDeps } from '../helpers/scenario';

beforeEach(async () => {
  await truncateAll();
  await seedTestCatalog(testPool());
});
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = (env: Record<string, string> = {}) => testDeps(env);
const q = async (text: string, params: unknown[] = []) => (await testPool().query(text, params)).rows;

async function teacher(o: { teachingAddress?: string | null; cep?: string | null } = {}) {
  const id = await insertTeacher(testPool());
  await testPool().query(
    `UPDATE teachers SET teaching_address = $2, base_cep = $3, base_lat = -23.56, base_lng = -46.65, travel_radius_km = 5
      WHERE id = $1`,
    [id, o.teachingAddress === undefined ? 'Rua das Flores, 100' : o.teachingAddress, o.cep === undefined ? '01310100' : o.cep],
  );
  await testPool().query(`INSERT INTO teacher_subjects (teacher_id, subject_id, grade_level_id) VALUES ($1, 1, 9)`, [id]);
  return id;
}

const online = { subjectId: 1, modality: 'online' as const, durationMin: 60, priceCents: 12100 };
const slotsIso = async (teacherId: string, serviceId: string, days = 7) =>
  (await availableSlots(deps(), { teacherId, serviceId, days }, NOW)).map((s) => new Date(s.epochMilliseconds).toISOString());

describe('regras semanais', () => {
  it('recusa fim antes do início e regra sobreposta no mesmo dia', async () => {
    const t = await teacher();
    await expect(addRule(deps(), t, { weekday: 2, start: '18:00', end: '14:00' })).rejects.toThrow(/fim depois do início/);
    await addRule(deps(), t, { weekday: 2, start: '14:00', end: '18:00' });
    await expect(addRule(deps(), t, { weekday: 2, start: '17:00', end: '19:00' })).rejects.toThrow(/sobrepõe/);
    await expect(addRule(deps(), t, { weekday: 2, start: '18:00', end: '19:00' })).resolves.toBeTruthy(); // encosta, não sobrepõe
  });

  it('mudar a regra muda os horários livres na hora e não mexe na aula já vendida', async () => {
    const t = await teacher();
    const svc = await createService(deps(), t, online);
    const rule = await addRule(deps(), t, { weekday: 2, start: '14:00', end: '16:00' });
    expect(await slotsIso(t, svc)).toEqual(['2026-11-17 14:00', '2026-11-17 14:30', '2026-11-17 15:00'].map(sp));
    const fam = await insertFamilyOrder(testPool(), t, svc);
    const booking = await insertBooking(testPool(), { ...fam, teacherId: t, serviceId: svc, startsAt: '2026-11-17 14:00-03' });

    await removeRule(deps(), t, rule);
    await addRule(deps(), t, { weekday: 2, start: '09:00', end: '10:00' });
    expect(await slotsIso(t, svc)).toEqual([sp('2026-11-17 09:00')]);
    expect(await q(`SELECT status, starts_at FROM bookings WHERE id = $1`, [booking])).toEqual([
      { status: 'confirmed', starts_at: new Date(sp('2026-11-17 14:00')) },
    ]);
  });
});

describe('exceções por data', () => {
  it('bloqueio de dia inteiro tira os horários; horário extra acrescenta', async () => {
    const t = await teacher();
    const svc = await createService(deps(), t, online);
    await addRule(deps(), t, { weekday: 2, start: '14:00', end: '15:00' });
    await addOverride(deps(), t, { date: '2026-11-17', kind: 'block' });
    await addOverride(deps(), t, { date: '2026-11-18', kind: 'extra', start: '10:00', end: '11:00' });
    expect(await slotsIso(t, svc)).toEqual([sp('2026-11-18 10:00')]);
  });

  it('horário extra exige início e fim', async () => {
    const t = await teacher();
    await expect(addOverride(deps(), t, { date: '2026-11-18', kind: 'extra' })).rejects.toThrow(/início e fim/);
  });
});

describe('ajustes da agenda', () => {
  it('valida antecedência, janela, grade e limite diário', async () => {
    const t = await teacher();
    await updateScheduleSettings(deps(), t, { minNoticeMin: 240, horizonDays: 30, slotStepMin: 15, maxLessonsPerDay: 4 });
    expect(await q(`SELECT min_notice_min, horizon_days, slot_step_min, max_lessons_per_day FROM teachers WHERE id = $1`, [t]))
      .toEqual([{ min_notice_min: 240, horizon_days: 30, slot_step_min: 15, max_lessons_per_day: 4 }]);
    await expect(updateScheduleSettings(deps(), t, { minNoticeMin: 0, horizonDays: 0, slotStepMin: 30, maxLessonsPerDay: null }))
      .rejects.toThrow(/janela/);
    await expect(updateScheduleSettings(deps(), t, { minNoticeMin: 0, horizonDays: 30, slotStepMin: 7, maxLessonsPerDay: null }))
      .rejects.toThrow(/grade/);
  });
});

describe('serviços', () => {
  it('presencial sugere 30 minutos de deslocamento antes e depois; o professor pode mudar', async () => {
    const t = await teacher();
    const a = await createService(deps(), t, { ...online, modality: 'at_student' });
    const b = await createService(deps(), t, { ...online, modality: 'at_teacher', bufferBeforeMin: 0, bufferAfterMin: 15 });
    const rows = await q(`SELECT id, modality, buffer_before_min, buffer_after_min, subject FROM services ORDER BY modality`);
    expect(rows.find((r) => r.id === a)).toMatchObject({ buffer_before_min: 30, buffer_after_min: 30, subject: 'matematica' });
    expect(rows.find((r) => r.id === b)).toMatchObject({ buffer_before_min: 0, buffer_after_min: 15 });
  });

  it('respeita o piso de preço, a disciplina ensinada e o endereço do presencial', async () => {
    const t = await teacher({ teachingAddress: null, cep: null });
    await expect(createService(deps({ PRICE_FLOOR_CENTS: '5000' }), t, { ...online, priceCents: 4999 })).rejects.toThrow(/R\$ 50,00/);
    await expect(createService(deps(), t, { ...online, subjectId: 2 })).rejects.toThrow(/disciplina/);
    await expect(createService(deps(), t, { ...online, modality: 'at_teacher' })).rejects.toThrow(/endereço onde você dá aula/);
    await expect(createService(deps(), t, { ...online, modality: 'at_student' })).rejects.toThrow(/CEP e o raio/);
  });

  it('mudar preço ou desativar não altera pedidos existentes; serviço inativo some dos horários', async () => {
    const t = await teacher();
    const svc = await createService(deps(), t, online);
    await addRule(deps(), t, { weekday: 2, start: '14:00', end: '15:00' });
    const fam = await insertFamilyOrder(testPool(), t, svc, { total_cents: 12100 });
    await updateService(deps(), t, svc, { priceCents: 15000, active: false });
    expect(await q(`SELECT total_cents FROM orders WHERE id = $1`, [fam.orderId])).toEqual([{ total_cents: 12100 }]);
    expect(await availableSlots(deps(), { teacherId: t, serviceId: svc, days: 9 }, NOW)).toEqual([]);
  });
});

describe('calendário', () => {
  it('conecta o calendário (adaptador falso) com o calendário próprio "Aulas"', async () => {
    const t = await teacher();
    await connectCalendar(deps(), t, NOW);
    await connectCalendar(deps(), t, NOW);
    expect(await q(`SELECT provider, status, lessons_calendar_id FROM calendar_connections WHERE teacher_id = $1`, [t])).toEqual([
      { provider: 'fake', status: 'active', lessons_calendar_id: 'Aulas' },
    ]);
  });
});
