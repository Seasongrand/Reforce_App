/**
 * Painel interno (§3.7): análise dos documentos, aprovação do perfil, acesso
 * aos arquivos por link temporário e vencimento da certidão.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { approveTeacher, decideVerification, expireVerifications, reviewQueue, setTeacherStatus, verificationFileLinks } from '@/domain/staff/review';
import { serveVerificationFile } from '@/domain/staff/files';
import { submitVerificationDocument } from '@/domain/teachers/verification';
import { updateTeacherProfile } from '@/domain/teachers/profile';
import { openPaymentAccount } from '@/domain/teachers/payment-account';
import { submitForReview } from '@/domain/teachers/review';
import { closeAppDb } from '../helpers/app';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { insertTeacher, seedTestCatalog } from '../helpers/fixtures';
import { NOW, testDeps } from '../helpers/scenario';

beforeEach(async () => {
  await truncateAll();
  await seedTestCatalog(testPool());
  await rm(path.resolve('var/test-private'), { recursive: true, force: true });
});
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = () => testDeps();
const q = async (text: string, params: unknown[] = []) => (await testPool().query(text, params)).rows;
const pdf = (name: string) => ({ name, contentType: 'application/pdf', bytes: new TextEncoder().encode(`%PDF ${name}`) });

async function staff() {
  return (await q(`INSERT INTO staff_users (email, name) VALUES ('ops@exemplo.com', 'Ops') RETURNING id`))[0]!.id as string;
}

/** Professor em análise, com os três documentos enviados e conta aberta. */
async function teacherInReview() {
  const id = await insertTeacher(testPool());
  await testPool().query(`UPDATE teachers SET email = 'ana@exemplo.com' WHERE id = $1`, [id]);
  await updateTeacherProfile(deps(), id, {
    displayName: 'Ana Souza', slug: 'ana-souza', timezone: 'America/Sao_Paulo', whatsappOptIn: false, subjects: [[1, 9]],
  }, NOW);
  await submitVerificationDocument(deps(), id, { kind: 'identity', files: [pdf('rg.pdf'), pdf('selfie.pdf')] }, NOW);
  await submitVerificationDocument(deps(), id, { kind: 'criminal_record', files: [pdf('certidao.pdf')] }, NOW);
  await submitVerificationDocument(deps(), id, { kind: 'education', files: [pdf('diploma.pdf')] }, NOW);
  await openPaymentAccount(deps(), id, {
    name: 'Ana Souza', email: 'ana@exemplo.com', cpfCnpj: '52998224725', birthDate: '1990-05-10', phone: '11977776666',
    postalCode: '01310100', address: 'Av. Paulista', addressNumber: '1000', incomeValueCents: 500000,
  }, NOW);
  await submitForReview(deps(), id, NOW);
  const v = await q(`SELECT id, kind FROM teacher_verifications WHERE teacher_id = $1`, [id]);
  const byKind = Object.fromEntries(v.map((r) => [r.kind, r.id as string]));
  return { teacherId: id, verifications: byKind as Record<'identity' | 'criminal_record' | 'education', string> };
}

describe('fila e decisões', () => {
  it('a fila mostra o professor em análise com os três documentos e seus arquivos', async () => {
    const t = await teacherInReview();
    const queue = await reviewQueue(deps());
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ teacherId: t.teacherId, name: 'Ana Souza', status: 'in_review' });
    expect(queue[0]!.verifications.map((v) => [v.kind, v.files.length]).sort()).toEqual([
      ['criminal_record', 1], ['education', 1], ['identity', 2],
    ]);
  });

  it('aprovar a certidão grava validade padrão de 6 meses e quem decidiu', async () => {
    const t = await teacherInReview();
    const s = await staff();
    await decideVerification(deps(), { verificationId: t.verifications.criminal_record, staffId: s, decision: 'approved' }, NOW);
    expect(await q(`SELECT status, valid_until::text, decided_by FROM teacher_verifications WHERE id = $1`, [
      t.verifications.criminal_record,
    ])).toEqual([{ status: 'approved', valid_until: '2027-05-16', decided_by: s }]);
  });

  it('recusar exige motivo, devolve o cadastro ao professor e o avisa por e-mail', async () => {
    const t = await teacherInReview();
    const s = await staff();
    await expect(
      decideVerification(deps(), { verificationId: t.verifications.education, staffId: s, decision: 'rejected' }, NOW),
    ).rejects.toThrow(/motivo/);
    await decideVerification(
      deps(), { verificationId: t.verifications.education, staffId: s, decision: 'rejected', note: 'Arquivo ilegível' }, NOW,
    );
    expect(await q(`SELECT status FROM teachers WHERE id = $1`, [t.teacherId])).toEqual([{ status: 'draft' }]);
    const mail = await q(`SELECT body FROM dev_outbox WHERE recipient = 'ana@exemplo.com' ORDER BY id DESC LIMIT 1`);
    expect(mail[0]!.body).toContain('Arquivo ilegível');
  });

  it('não aprova o perfil com documento pendente; com os três aprovados, entra na lista de quem vende', async () => {
    const t = await teacherInReview();
    const s = await staff();
    await decideVerification(deps(), { verificationId: t.verifications.identity, staffId: s, decision: 'approved' }, NOW);
    await expect(approveTeacher(deps(), { teacherId: t.teacherId, staffId: s }, NOW)).rejects.toThrow(/três verificações/);
    await decideVerification(deps(), { verificationId: t.verifications.criminal_record, staffId: s, decision: 'approved' }, NOW);
    await decideVerification(deps(), { verificationId: t.verifications.education, staffId: s, decision: 'approved' }, NOW);
    await approveTeacher(deps(), { teacherId: t.teacherId, staffId: s }, NOW);
    expect(await q(`SELECT id FROM teachers_listed`)).toEqual([{ id: t.teacherId }]);
    expect(await reviewQueue(deps())).toEqual([]);
  });

  it('pausar e suspender tiram o professor da lista de quem vende', async () => {
    const t = await teacherInReview();
    const s = await staff();
    for (const k of ['identity', 'criminal_record', 'education'] as const) {
      await decideVerification(deps(), { verificationId: t.verifications[k], staffId: s, decision: 'approved' }, NOW);
    }
    await approveTeacher(deps(), { teacherId: t.teacherId, staffId: s }, NOW);
    await setTeacherStatus(deps(), { teacherId: t.teacherId, staffId: s, status: 'suspended' }, NOW);
    expect(await q(`SELECT id FROM teachers_listed`)).toEqual([]);
  });
});

describe('vencimento da certidão', () => {
  it('a varredura diária marca a certidão vencida e o professor sai da lista', async () => {
    const t = await teacherInReview();
    const s = await staff();
    for (const k of ['identity', 'criminal_record', 'education'] as const) {
      await decideVerification(deps(), { verificationId: t.verifications[k], staffId: s, decision: 'approved' }, NOW);
    }
    await approveTeacher(deps(), { teacherId: t.teacherId, staffId: s }, NOW);
    expect(await expireVerifications(deps(), NOW.add({ hours: 24 * 100 }))).toBe(0);
    expect(await expireVerifications(deps(), NOW.add({ hours: 24 * 200 }))).toBe(1);
    expect(await q(`SELECT status FROM teacher_verifications WHERE id = $1`, [t.verifications.criminal_record])).toEqual([
      { status: 'expired' },
    ]);
    expect(await q(`SELECT id FROM teachers_listed`)).toEqual([]);
  });
});

describe('arquivos por link temporário', () => {
  it('só a equipe abre, e só até o link vencer', async () => {
    const t = await teacherInReview();
    const s = await staff();
    const [link] = await verificationFileLinks(deps(), t.verifications.education, NOW);
    const u = new URL(link!.url);
    const params = { key: u.searchParams.get('key')!, exp: u.searchParams.get('exp')!, sig: u.searchParams.get('sig')! };

    expect((await serveVerificationFile(deps(), { staffId: null, ...params }, NOW)).status).toBe(403);
    expect((await serveVerificationFile(deps(), { staffId: s, ...params }, NOW.add({ minutes: 6 }))).status).toBe(403);
    expect((await serveVerificationFile(deps(), { staffId: s, ...params, key: params.key.replace('diploma', 'x') }, NOW)).status)
      .toBe(403);
    const ok = await serveVerificationFile(deps(), { staffId: s, ...params }, NOW);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe('application/pdf');
    expect(ok.headers.get('cache-control')).toContain('no-store');
    expect(await ok.text()).toBe('%PDF diploma.pdf');
  });
});
