/**
 * Lista de avisos para alunos: enquanto a plataforma não abre, o botão
 * "Entrar" leva a uma página onde o adulto responsável (ou o aluno maior de
 * idade) deixa o e-mail para ser avisado da abertura.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  joinStudentWaitlist, serveStudentWaitlistExport, studentWaitlistCsv, type StudentWaitlistInput,
} from '@/domain/student-waitlist';
import { closeAppDb } from '../helpers/app';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { NOW, testDeps } from '../helpers/scenario';

beforeEach(truncateAll);
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = (env: Record<string, string> = {}) => testDeps(env);
const q = async (text: string) => (await testPool().query(text)).rows;

const entry = (over: Partial<StudentWaitlistInput> = {}): StudentWaitlistInput => ({
  email: ' Paula@Exemplo.com ', city: ' Niterói ', state: 'rj', subjectIds: [1, 13], stages: ['medio'],
  adultConsent: true, website: '', ...over,
});

describe('inscrição de aluno para ser avisado da abertura', () => {
  it('grava a inscrição normalizada', async () => {
    expect(await joinStudentWaitlist(deps(), entry(), NOW)).toEqual({ created: true });
    expect(await q(`SELECT email, city, state, subject_ids, stages, consent_at IS NOT NULL AS consent FROM student_waitlist`))
      .toEqual([{ email: 'paula@exemplo.com', city: 'Niterói', state: 'RJ', subject_ids: [1, 13], stages: ['medio'], consent: true }]);
  });

  it('o mesmo e-mail de novo atualiza a inscrição, sem duplicar', async () => {
    await joinStudentWaitlist(deps(), entry(), NOW);
    expect(await joinStudentWaitlist(deps(), entry({ city: 'Rio de Janeiro', stages: ['fund2', 'pre_vestibular'] }), NOW))
      .toEqual({ created: false });
    expect(await q(`SELECT city, stages FROM student_waitlist`)).toEqual([{ city: 'Rio de Janeiro', stages: ['fund2', 'pre_vestibular'] }]);
  });

  it('exige maioridade com autorização, e-mail, cidade, UF, disciplina e etapa válidos', async () => {
    await expect(joinStudentWaitlist(deps(), entry({ adultConsent: false }), NOW)).rejects.toThrow(/18 anos/);
    await expect(joinStudentWaitlist(deps(), entry({ email: 'sem-arroba' }), NOW)).rejects.toThrow(/e-mail/);
    await expect(joinStudentWaitlist(deps(), entry({ city: ' ' }), NOW)).rejects.toThrow(/cidade/);
    await expect(joinStudentWaitlist(deps(), entry({ state: 'XYZ' }), NOW)).rejects.toThrow(/UF/);
    await expect(joinStudentWaitlist(deps(), entry({ subjectIds: [] }), NOW)).rejects.toThrow(/disciplina/);
    await expect(joinStudentWaitlist(deps(), entry({ subjectIds: [999] }), NOW)).rejects.toThrow(/disciplina/);
    await expect(joinStudentWaitlist(deps(), entry({ stages: [] }), NOW)).rejects.toThrow(/etapa/);
    await expect(joinStudentWaitlist(deps(), entry({ stages: ['faculdade' as never] }), NOW)).rejects.toThrow(/etapa/);
    expect(await q(`SELECT count(*)::int AS n FROM student_waitlist`)).toEqual([{ n: 0 }]);
  });

  it('campo-armadilha preenchido (robô): responde como sucesso e não grava nada', async () => {
    expect(await joinStudentWaitlist(deps(), entry({ website: 'http://spam.example' }), NOW)).toEqual({ created: true });
    expect(await q(`SELECT count(*)::int AS n FROM student_waitlist`)).toEqual([{ n: 0 }]);
  });
});

describe('planilha dos alunos', () => {
  const basic = (pw: string) => `Basic ${Buffer.from(`equipe:${pw}`).toString('base64')}`;

  it('traz e-mail, cidade, disciplinas e etapas pelo nome, neutralizando fórmulas', async () => {
    await joinStudentWaitlist(deps(), entry(), NOW);
    await joinStudentWaitlist(deps(), entry({ email: 'b@exemplo.com', city: '=HYPERLINK("http://x")' }), NOW.add({ hours: 1 }));
    const [header, row] = (await studentWaitlistCsv(deps())).split('\r\n');
    expect(header).toBe('email,cidade,uf,disciplinas,etapas,inscrito_em,atualizado_em');
    expect(row).toContain('paula@exemplo.com,Niterói,RJ,Matemática; Inglês,Ensino médio,');
    expect(await studentWaitlistCsv(deps())).toContain(`"'=HYPERLINK(""http://x"")"`);
  });

  it('protegida pela mesma senha da planilha dos professores', async () => {
    await joinStudentWaitlist(deps(), entry(), NOW);
    expect((await serveStudentWaitlistExport(deps(), null)).status).toBe(404);
    const d = deps({ WAITLIST_EXPORT_PASSWORD: 'senha-longa-de-teste' });
    expect((await serveStudentWaitlistExport(d, null)).status).toBe(401);
    expect((await serveStudentWaitlistExport(d, basic('errada'))).status).toBe(401);
    const ok = await serveStudentWaitlistExport(d, basic('senha-longa-de-teste'));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(ok.headers.get('content-disposition')).toContain('lista-de-espera-alunos.csv');
    expect(ok.headers.get('cache-control')).toContain('no-store');
    expect(await ok.text()).toContain('paula@exemplo.com');
  });
});
