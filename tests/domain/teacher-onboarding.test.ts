/**
 * Cadastro do professor (§1, professor, passos 1 a 4): perfil, documentos de
 * verificação fora do banco, conta de recebimento e envio para análise.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { updateTeacherProfile, type ProfileInput } from '@/domain/teachers/profile';
import { listVerifications, submitVerificationDocument } from '@/domain/teachers/verification';
import { openPaymentAccount, isValidCpfCnpj } from '@/domain/teachers/payment-account';
import { submitForReview } from '@/domain/teachers/review';
import { appDb, closeAppDb } from '../helpers/app';
import { closeTestPool, queuedJobs, testPool, truncateAll } from '../helpers/db';
import { insertTeacher, seedTestCatalog } from '../helpers/fixtures';
import { NOW, testDeps } from '../helpers/scenario';

const STORAGE = path.resolve('var/test-private');

beforeEach(async () => {
  await truncateAll();
  await seedTestCatalog(testPool());
  await rm(STORAGE, { recursive: true, force: true });
});
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = () => testDeps();
const q = async (text: string, params: unknown[] = []) => (await testPool().query(text, params)).rows;
const file = (name: string, content = 'conteúdo sigiloso 123.456.789-09', contentType = 'application/pdf') => ({
  name, contentType, bytes: new TextEncoder().encode(content),
});

const profile = (over: Partial<ProfileInput> = {}): ProfileInput => ({
  displayName: 'Ana Souza', slug: 'ana-souza', headline: 'Matemática para o 9º ano e ensino médio',
  bio: 'Licenciada em Matemática, dou aulas de reforço e recuperação.', timezone: 'America/Sao_Paulo',
  phone: '(11) 97777-6666', whatsappOptIn: true, baseCep: '01310-100', travelRadiusKm: 5,
  teachingAddress: 'Rua das Flores, 100, Pinheiros', subjects: [[1, 9], [1, 10]], ...over,
});

const ACCOUNT = {
  name: 'Ana Souza', email: 'ana@exemplo.com', cpfCnpj: '529.982.247-25', birthDate: '1990-05-10',
  phone: '11977776666', postalCode: '01310-100', address: 'Av. Paulista', addressNumber: '1000', incomeValueCents: 500000,
};

describe('perfil', () => {
  it('salva perfil, disciplinas, telefone em E.164 e o centro do CEP; enfileira o índice de busca', async () => {
    const id = await insertTeacher(testPool());
    await updateTeacherProfile(deps(), id, profile(), NOW);
    const [t] = await q(
      `SELECT display_name, slug, phone_e164, base_cep, base_lat IS NOT NULL AS geo, travel_radius_km, teaching_address
         FROM teachers WHERE id = $1`, [id],
    );
    expect(t).toEqual({
      display_name: 'Ana Souza', slug: 'ana-souza', phone_e164: '+5511977776666', base_cep: '01310100', geo: true,
      travel_radius_km: '5.0', teaching_address: 'Rua das Flores, 100, Pinheiros',
    });
    expect(await q(`SELECT subject_id, grade_level_id FROM teacher_subjects ORDER BY 2`)).toEqual([
      { subject_id: 1, grade_level_id: 9 }, { subject_id: 1, grade_level_id: 10 },
    ]);
    expect((await queuedJobs()).map((j) => j.task)).toContain('search.refresh_teacher');
  });

  it('recusa endereço de página inválido ou já usado', async () => {
    const a = await insertTeacher(testPool());
    const b = await insertTeacher(testPool());
    await updateTeacherProfile(deps(), a, profile(), NOW);
    await expect(updateTeacherProfile(deps(), b, profile(), NOW)).rejects.toThrow(/já está em uso/);
    await expect(updateTeacherProfile(deps(), b, profile({ slug: 'Ana Souza!' }), NOW)).rejects.toThrow(/endereço/);
  });

  it('exige ao menos uma disciplina e série do catálogo', async () => {
    const id = await insertTeacher(testPool());
    await expect(updateTeacherProfile(deps(), id, profile({ subjects: [] }), NOW)).rejects.toThrow(/disciplina/);
    await expect(updateTeacherProfile(deps(), id, profile({ subjects: [[99, 9]] }), NOW)).rejects.toThrow(/disciplina/);
  });
});

describe('documentos de verificação', () => {
  it('identidade exige documento e selfie; os arquivos ficam cifrados fora do banco', async () => {
    const id = await insertTeacher(testPool());
    await expect(
      submitVerificationDocument(deps(), id, { kind: 'identity', files: [file('rg.pdf')] }, NOW),
    ).rejects.toThrow(/documento e selfie/);
    await submitVerificationDocument(
      deps(), id, { kind: 'identity', files: [file('rg.pdf'), file('selfie.jpg', 'selfie', 'image/jpeg')] }, NOW,
    );
    const [v] = await q(`SELECT kind, status, evidence_key FROM teacher_verifications WHERE teacher_id = $1`, [id]);
    expect(v).toMatchObject({ kind: 'identity', status: 'pending' });
    expect(v!.evidence_key).toMatch(new RegExp(`^verificacoes/${id}/`));
    // nada do conteúdo no banco
    const dump = JSON.stringify(await q(`SELECT * FROM teacher_verifications`));
    expect(dump).not.toContain('123.456.789-09');
    // no disco, só cifrado
    const dir = path.join(STORAGE, v!.evidence_key as string);
    const files = await readdir(dir);
    expect(files).toHaveLength(2);
    for (const f of files) expect((await readFile(path.join(dir, f))).toString('latin1')).not.toContain('123.456.789-09');
    expect((await listVerifications(deps(), id)).find((x) => x.kind === 'identity')?.files).toHaveLength(2);
  });

  it('recusa tipo de arquivo não aceito e arquivo grande demais', async () => {
    const id = await insertTeacher(testPool());
    await expect(
      submitVerificationDocument(deps(), id, { kind: 'education', files: [file('diploma.exe', 'x', 'application/x-msdownload')] }, NOW),
    ).rejects.toThrow(/PDF, JPG, PNG/);
    const big = { name: 'grande.pdf', contentType: 'application/pdf', bytes: new Uint8Array(10 * 1024 * 1024 + 1) };
    await expect(submitVerificationDocument(deps(), id, { kind: 'education', files: [big] }, NOW)).rejects.toThrow(/10 MB/);
  });

  it('não aceita segundo envio enquanto o primeiro está em análise; depois de recusado, aceita', async () => {
    const id = await insertTeacher(testPool());
    await submitVerificationDocument(deps(), id, { kind: 'criminal_record', files: [file('certidao.pdf')] }, NOW);
    await expect(
      submitVerificationDocument(deps(), id, { kind: 'criminal_record', files: [file('certidao.pdf')] }, NOW),
    ).rejects.toThrow(/em análise/);
    await testPool().query(`UPDATE teacher_verifications SET status = 'rejected', decision_note = 'ilegível'`);
    await submitVerificationDocument(deps(), id, { kind: 'criminal_record', files: [file('certidao2.pdf')] }, NOW);
    const rows = await q(`SELECT status FROM teacher_verifications ORDER BY submitted_at, status`);
    expect(rows.map((r) => r.status).sort()).toEqual(['pending', 'rejected']);
  });
});

describe('conta de recebimento', () => {
  it('valida CPF e CNPJ pelos dígitos verificadores', () => {
    expect(isValidCpfCnpj('529.982.247-25')).toBe(true);
    expect(isValidCpfCnpj('111.111.111-11')).toBe(false);
    expect(isValidCpfCnpj('529.982.247-26')).toBe(false);
    expect(isValidCpfCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCpfCnpj('11.222.333/0001-82')).toBe(false);
  });

  it('abre a conta no provedor e guarda só os identificadores, nunca o CPF', async () => {
    const id = await insertTeacher(testPool());
    await openPaymentAccount(deps(), id, ACCOUNT, NOW);
    const [acc] = await q(`SELECT provider, status, wallet_id FROM teacher_payment_accounts WHERE teacher_id = $1`, [id]);
    expect(acc).toMatchObject({ provider: 'fake', status: 'active' });
    const everything = JSON.stringify([
      await q(`SELECT * FROM teacher_payment_accounts`), await q(`SELECT * FROM dev_provider_calls`), await q(`SELECT * FROM teachers`),
    ]);
    expect(everything).not.toContain('52998224725');
    expect(everything).not.toContain('529.982.247-25');
    await expect(openPaymentAccount(deps(), id, ACCOUNT, NOW)).rejects.toThrow(/já tem conta/);
  });

  it('recusa CPF inválido', async () => {
    const id = await insertTeacher(testPool());
    await expect(openPaymentAccount(deps(), id, { ...ACCOUNT, cpfCnpj: '123' }, NOW)).rejects.toThrow(/CPF ou CNPJ/);
  });
});

describe('envio para análise', () => {
  it('lista o que falta; completo, passa para em análise', async () => {
    const id = await insertTeacher(testPool());
    await expect(submitForReview(deps(), id, NOW)).rejects.toThrow(/perfil.*identidade.*antecedentes.*formação.*recebimento/s);
    await updateTeacherProfile(deps(), id, profile(), NOW);
    await submitVerificationDocument(deps(), id, { kind: 'identity', files: [file('rg.pdf'), file('selfie.jpg')] }, NOW);
    await submitVerificationDocument(deps(), id, { kind: 'criminal_record', files: [file('certidao.pdf')] }, NOW);
    await submitVerificationDocument(deps(), id, { kind: 'education', files: [file('diploma.pdf')] }, NOW);
    await openPaymentAccount(deps(), id, ACCOUNT, NOW);
    await submitForReview(deps(), id, NOW);
    expect(await q(`SELECT status FROM teachers WHERE id = $1`, [id])).toEqual([{ status: 'in_review' }]);
    await expect(submitForReview(deps(), id, NOW)).rejects.toThrow(/já está em análise/);
    void appDb;
  });
});
