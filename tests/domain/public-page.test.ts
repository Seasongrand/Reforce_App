/**
 * Página pública do professor (§1, família, passo 3) e o pedido da família.
 * A página nunca expõe contato nem endereço do professor; o pedido só é
 * visível para o responsável que o fez.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { publicTeacherPage } from '@/domain/public/teacher-page';
import { orderView } from '@/domain/public/order';
import { holdSlots } from '@/domain/booking/hold';
import { startPayment } from '@/domain/payment/charge';
import { closeAppDb } from '../helpers/app';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { seedTestCatalog } from '../helpers/fixtures';
import { family, listedTeacher, NOW, paidLesson, testDeps, TUE_14 } from '../helpers/scenario';

beforeEach(async () => {
  await truncateAll();
  await seedTestCatalog(testPool());
});
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = () => testDeps();

async function slugOf(teacherId: string) {
  await testPool().query(
    `UPDATE teachers SET slug = 'ana-souza', display_name = 'Ana Souza', headline = 'Matemática sem medo',
            phone_e164 = '+5511977776666', teaching_address = 'Rua Secreta, 42' WHERE id = $1`,
    [teacherId],
  );
  await testPool().query(`INSERT INTO teacher_subjects (teacher_id, subject_id, grade_level_id) VALUES ($1, 1, 9)`, [teacherId]);
  return 'ana-souza';
}

describe('página pública do professor', () => {
  it('mostra perfil, selo com validade, serviços e horários livres; nunca contato nem endereço', async () => {
    const t = await listedTeacher();
    const slug = await slugOf(t.teacherId);
    const page = await publicTeacherPage(deps(), slug, NOW);
    expect(page).not.toBeNull();
    expect(page).toMatchObject({ name: 'Ana Souza', headline: 'Matemática sem medo', sellable: true, timezone: 'America/Sao_Paulo' });
    expect(page!.subjects).toEqual([{ subject: 'Matemática', grades: ['9º ano'] }]);
    expect(page!.badges.map((b) => b.kind).sort()).toEqual(['criminal_record', 'education', 'identity']);
    expect(page!.badges.find((b) => b.kind === 'criminal_record')!.validUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(page!.services).toHaveLength(1);
    expect(page!.services[0]!.slots[0]).toBe(TUE_14.toString());
    const json = JSON.stringify(page);
    for (const secret of ['+5511977776666', 'Rua Secreta', '@exemplo.com', 'wal_', 'acc_']) expect(json).not.toContain(secret);
  });

  it('perfil não aprovado não existe para o público', async () => {
    const t = await listedTeacher();
    const slug = await slugOf(t.teacherId);
    await testPool().query(`UPDATE teachers SET status = 'in_review' WHERE id = $1`, [t.teacherId]);
    expect(await publicTeacherPage(deps(), slug, NOW)).toBeNull();
    expect(await publicTeacherPage(deps(), 'nao-existe', NOW)).toBeNull();
  });

  it('aprovado com certidão vencida aparece como agenda indisponível, sem horários', async () => {
    const t = await listedTeacher({ criminalRecordExpired: true });
    const slug = await slugOf(t.teacherId);
    const page = await publicTeacherPage(deps(), slug, NOW);
    expect(page).toMatchObject({ sellable: false });
    expect(page!.services.every((s) => s.slots.length === 0)).toBe(true);
  });
});

describe('pedido da família', () => {
  it('mostra o pedido em reserva temporária com o prazo e a cobrança', async () => {
    const t = await listedTeacher();
    await slugOf(t.teacherId);
    const f = await family();
    const r = await holdSlots(deps(), {
      teacherId: t.teacherId, serviceId: t.serviceId, guardianId: f.guardianId, studentId: f.studentId,
      startsAt: [TUE_14], idempotencyKey: randomUUID(),
    }, NOW);
    if (!r.ok) throw new Error('esperava reserva');
    expect(await orderView(deps(), r.orderId, f.guardianId, NOW)).toMatchObject({
      status: 'awaiting_payment', bookingStatus: 'held', totalCents: 12100, teacherName: 'Ana Souza',
      holdExpiresAt: r.holdExpiresAt.toString(), payment: null,
    });
    await startPayment(deps(), { orderId: r.orderId, guardianId: f.guardianId, method: 'pix' }, NOW);
    const v = await orderView(deps(), r.orderId, f.guardianId, NOW);
    expect(v!.payment).toMatchObject({ method: 'pix', status: 'pending' });
    expect(v!.payment!.pixPayload).toContain('FAKEPIX');
  });

  it('pedido de outro responsável não aparece', async () => {
    const l = await paidLesson();
    const stranger = await family();
    expect(await orderView(deps(), l.orderId, stranger.guardianId, NOW)).toBeNull();
    expect(await orderView(deps(), l.orderId, l.guardianId, NOW)).toMatchObject({ status: 'paid', bookingStatus: 'confirmed' });
  });
});
