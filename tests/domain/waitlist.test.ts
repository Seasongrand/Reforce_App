/**
 * Lista de espera de professores (§4, largada a frio: recrutar de 30 a 50
 * professores antes da abertura) e a exportação em planilha.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { joinTeacherWaitlist, serveWaitlistExport, waitlistCsv, type WaitlistInput } from '@/domain/waitlist';
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

const entry = (over: Partial<WaitlistInput> = {}): WaitlistInput => ({
  name: 'Ana Souza', email: ' Ana@Exemplo.com ', phone: '(11) 97777-6666', city: 'São Paulo', state: 'sp',
  subjectIds: [1, 2], stages: ['fund2', 'medio'], modalities: ['online', 'presencial'], education: 'licenciatura',
  notes: 'Dou aulas há 5 anos.', consent: true, website: '', ...over,
});

describe('inscrição na lista de espera', () => {
  it('grava a inscrição normalizada', async () => {
    expect(await joinTeacherWaitlist(deps(), entry(), NOW)).toEqual({ created: true });
    expect(await q(`SELECT name, email, phone_e164, city, state, subject_ids, stages, modalities, education,
                           consent_at IS NOT NULL AS consent FROM teacher_waitlist`)).toEqual([{
      name: 'Ana Souza', email: 'ana@exemplo.com', phone_e164: '+5511977776666', city: 'São Paulo', state: 'SP',
      subject_ids: [1, 2], stages: ['fund2', 'medio'], modalities: ['online', 'presencial'], education: 'licenciatura',
      consent: true,
    }]);
  });

  it('o mesmo e-mail de novo atualiza a inscrição, sem duplicar', async () => {
    await joinTeacherWaitlist(deps(), entry(), NOW);
    expect(await joinTeacherWaitlist(deps(), entry({ city: 'Campinas', email: 'ana@exemplo.com' }), NOW)).toEqual({
      created: false,
    });
    expect(await q(`SELECT city FROM teacher_waitlist`)).toEqual([{ city: 'Campinas' }]);
  });

  it('exige autorização, disciplina, etapa, modalidade e dados válidos', async () => {
    await expect(joinTeacherWaitlist(deps(), entry({ consent: false }), NOW)).rejects.toThrow(/autoriz/);
    await expect(joinTeacherWaitlist(deps(), entry({ subjectIds: [] }), NOW)).rejects.toThrow(/disciplina/);
    await expect(joinTeacherWaitlist(deps(), entry({ subjectIds: [99] }), NOW)).rejects.toThrow(/disciplina/);
    await expect(joinTeacherWaitlist(deps(), entry({ stages: [] }), NOW)).rejects.toThrow(/etapa/);
    await expect(joinTeacherWaitlist(deps(), entry({ modalities: [] }), NOW)).rejects.toThrow(/modalidade/);
    await expect(joinTeacherWaitlist(deps(), entry({ email: 'sem-arroba' }), NOW)).rejects.toThrow(/e-mail/);
    await expect(joinTeacherWaitlist(deps(), entry({ state: 'XYZ' }), NOW)).rejects.toThrow(/UF/);
    await expect(joinTeacherWaitlist(deps(), entry({ education: 'qualquer' as never }), NOW)).rejects.toThrow(/formação/);
    expect(await q(`SELECT count(*)::int AS n FROM teacher_waitlist`)).toEqual([{ n: 0 }]);
  });

  it('telefone é opcional', async () => {
    await joinTeacherWaitlist(deps(), entry({ phone: '' }), NOW);
    expect(await q(`SELECT phone_e164 FROM teacher_waitlist`)).toEqual([{ phone_e164: null }]);
  });

  it('campo-armadilha preenchido (robô): responde como sucesso e não grava nada', async () => {
    expect(await joinTeacherWaitlist(deps(), entry({ website: 'http://spam.example' }), NOW)).toEqual({ created: true });
    expect(await q(`SELECT count(*)::int AS n FROM teacher_waitlist`)).toEqual([{ n: 0 }]);
  });
});

describe('exportação em planilha', () => {
  it('gera CSV com nomes das disciplinas, escapando aspas, vírgulas e quebras de linha', async () => {
    await joinTeacherWaitlist(deps(), entry({ notes: 'Diz "oi", e\npula linha' }), NOW);
    const csv = await waitlistCsv(deps());
    const [header, row] = csv.split('\r\n');
    expect(header).toBe('nome,email,whatsapp,cidade,uf,disciplinas,etapas,modalidades,formacao,observacoes,inscrito_em');
    expect(row).toContain('Ana Souza,ana@exemplo.com,+5511977776666,São Paulo,SP,Matemática; Física');
    expect(csv).toContain('"Diz ""oi"", e\npula linha"');
  });

  it('neutraliza fórmulas de planilha vindas do formulário', async () => {
    await joinTeacherWaitlist(deps(), entry({ name: '=HYPERLINK("http://x")' }), NOW);
    expect(await waitlistCsv(deps())).toContain(`"'=HYPERLINK(""http://x"")"`);
  });

  it('protegida por senha: sem senha configurada não existe; senha errada pede login; certa baixa', async () => {
    await joinTeacherWaitlist(deps(), entry(), NOW);
    expect((await serveWaitlistExport(deps(), null)).status).toBe(404);
    const d = deps({ WAITLIST_EXPORT_PASSWORD: 'senha-longa-de-teste' });
    const anon = await serveWaitlistExport(d, null);
    expect(anon.status).toBe(401);
    expect(anon.headers.get('www-authenticate')).toContain('Basic');
    const basic = (pw: string) => `Basic ${Buffer.from(`equipe:${pw}`).toString('base64')}`;
    expect((await serveWaitlistExport(d, basic('errada'))).status).toBe(401);
    const ok = await serveWaitlistExport(d, basic('senha-longa-de-teste'));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(ok.headers.get('content-disposition')).toContain('attachment');
    expect(ok.headers.get('cache-control')).toContain('no-store');
    expect(await ok.text()).toContain('ana@exemplo.com');
  });
});
