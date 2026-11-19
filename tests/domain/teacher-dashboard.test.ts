/**
 * Painel "Início" do professor: checklist do que falta para vender aulas,
 * próximas aulas e o link da página pública.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { teacherDashboard } from '@/domain/teachers/dashboard';
import { updateTeacherProfile, type ProfileInput } from '@/domain/teachers/profile';
import { submitVerificationDocument } from '@/domain/teachers/verification';
import { openPaymentAccount } from '@/domain/teachers/payment-account';
import { submitForReview } from '@/domain/teachers/review';
import { closeAppDb } from '../helpers/app';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { insertTeacher, seedTestCatalog } from '../helpers/fixtures';
import { family, listedTeacher, NOW, testDeps, TUE_14 } from '../helpers/scenario';

beforeEach(async () => {
  await truncateAll();
  await seedTestCatalog(testPool());
});
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = () => testDeps();
const file = (name: string) => ({ name, contentType: 'application/pdf', bytes: new TextEncoder().encode('conteúdo') });
const profile = (over: Partial<ProfileInput> = {}): ProfileInput => ({
  displayName: 'Ana Souza', slug: 'ana-souza', headline: 'Matemática para o 9º ano', bio: 'Licenciada em Matemática.',
  timezone: 'America/Sao_Paulo', phone: '(11) 97777-6666', whatsappOptIn: true, baseCep: '01310-100', travelRadiusKm: 5,
  teachingAddress: 'Rua das Flores, 100', subjects: [[1, 9]], ...over,
});
const ACCOUNT = {
  name: 'Ana Souza', email: 'ana@exemplo.com', cpfCnpj: '529.982.247-25', birthDate: '1990-05-10',
  phone: '11977776666', postalCode: '01310-100', address: 'Av. Paulista', addressNumber: '1000', incomeValueCents: 500000,
};
const stepsDone = (d: { steps: Array<{ key: string; done: boolean }> }) => d.steps.filter((s) => s.done).map((s) => s.key);

/** Reserva e paga várias aulas do mesmo professor, no mesmo pedido. */
async function paidLessons(teacherId: string, serviceId: string, starts: ReturnType<typeof TUE_14.add>[]) {
  const { holdSlots } = await import('@/domain/booking/hold');
  const { startPayment } = await import('@/domain/payment/charge');
  const { handlePaymentWebhook } = await import('@/domain/payment/webhook');
  const { FakePaymentProvider } = await import('@/providers/payment/fake');
  const f = await family();
  const d = deps();
  const r = await holdSlots(d, {
    teacherId, serviceId, guardianId: f.guardianId, studentId: f.studentId, addressId: f.addressId, startsAt: starts,
    idempotencyKey: randomUUID(),
  }, NOW);
  if (!r.ok) throw new Error(`esperava reserva, veio ${r.reason}`);
  const p = await startPayment(d, { orderId: r.orderId, guardianId: f.guardianId, method: 'pix' }, NOW);
  const charge = (await testPool().query(`SELECT provider_charge_id FROM payments WHERE id = $1`, [p.paymentId])).rows[0]!
    .provider_charge_id as string;
  const { headers, body } = (d.providers.payment as InstanceType<typeof FakePaymentProvider>).simulateEvent(charge, 'payment.paid');
  await handlePaymentWebhook(d, headers, body, NOW.add({ minutes: 1 }));
  return r.bookingIds;
}

describe('painel Início do professor', () => {
  it('professor novo: sete passos, nenhum feito, sem página no ar e sem envio para análise', async () => {
    const id = await insertTeacher(testPool(), { display_name: 'Ana Souza' });
    const d = await teacherDashboard(deps(), id, NOW);
    expect(d.steps.map((s) => s.key)).toEqual(['foto', 'perfil', 'documentos', 'recebimento', 'analise', 'servicos', 'agenda']);
    expect(d).toMatchObject({ firstName: 'Ana', status: 'draft', done: 0, total: 7, canSubmit: false, pageUrl: null, upcoming: [] });
    expect(d.steps.find((s) => s.key === 'foto')).toMatchObject({ href: '/professor/cadastro', done: false });
  });

  it('com foto enviada, perfil, documentos e conta: esses passos feitos e pode enviar para análise', async () => {
    const id = await insertTeacher(testPool());
    await updateTeacherProfile(deps(), id, profile(), NOW);
    await testPool().query(
      `INSERT INTO teacher_photos (teacher_id, image, width, height, status) VALUES ($1, '\\x00'::bytea, 512, 512, 'pending')`, [id],
    );
    await submitVerificationDocument(deps(), id, { kind: 'identity', files: [file('rg.pdf'), file('selfie.pdf')] }, NOW);
    await submitVerificationDocument(deps(), id, { kind: 'criminal_record', files: [file('certidao.pdf')] }, NOW);
    await submitVerificationDocument(deps(), id, { kind: 'education', files: [file('diploma.pdf')] }, NOW);
    await openPaymentAccount(deps(), id, ACCOUNT, NOW);
    const d = await teacherDashboard(deps(), id, NOW);
    expect(stepsDone(d)).toEqual(['foto', 'perfil', 'documentos', 'recebimento']);
    expect(d.steps.find((s) => s.key === 'foto')!.detail).toBe('Em análise');
    expect(d).toMatchObject({ done: 4, canSubmit: true, pageUrl: null });
    await submitForReview(deps(), id, NOW);
    const after = await teacherDashboard(deps(), id, NOW);
    expect(after).toMatchObject({ status: 'in_review', canSubmit: false });
    expect(after.steps.find((s) => s.key === 'analise')).toMatchObject({ done: false, detail: 'Em análise pela equipe' });
  });

  it('aprovado, com serviço e horário: os sete passos feitos e o link da página pública', async () => {
    const t = await listedTeacher();
    await testPool().query(`UPDATE teachers SET slug = 'ana-souza' WHERE id = $1`, [t.teacherId]);
    await testPool().query(`INSERT INTO teacher_subjects (teacher_id, subject_id, grade_level_id) VALUES ($1, 1, 9)`, [t.teacherId]);
    const d = await teacherDashboard(deps(), t.teacherId, NOW);
    expect(d).toMatchObject({ done: 7, total: 7, status: 'approved', canSubmit: false });
    expect(d.pageUrl).toBe(`${deps().config.appBaseUrl}/p/ana-souza`);
  });

  it('próximas aulas: só as confirmadas que ainda não terminaram, no máximo 3, em ordem', async () => {
    const t = await listedTeacher();
    const ids = await paidLessons(t.teacherId, t.serviceId, [0, 1, 2, 3].map((h) => TUE_14.add({ hours: h })));
    const d = await teacherDashboard(deps(), t.teacherId, NOW);
    expect(d.upcoming.map((l) => l.bookingId)).toEqual(ids.slice(0, 3));
    expect(d.upcoming.map((l) => l.startsAt.toString())).toEqual([0, 1, 2].map((h) => TUE_14.add({ hours: h }).toString()));
    expect((await teacherDashboard(deps(), t.teacherId, TUE_14.add({ hours: 5 }))).upcoming).toEqual([]);
  });
});
