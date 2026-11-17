/**
 * Lista de espera de professores (§4, largada a frio: recrutar de 30 a 50
 * professores antes da abertura) e a exportação em planilha.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  EDUCATION, joinTeacherWaitlist, serveWaitlistCv, serveWaitlistExport, waitlistCsv, WAITLIST_SUBJECTS, type WaitlistInput,
} from '@/domain/waitlist';
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
    expect(header).toBe('nome,email,whatsapp,cidade,uf,disciplinas,etapas,modalidades,formacao,observacoes,inscrito_em,curriculo');
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

describe('disciplinas, formação e currículo', () => {
  const pdf = (bytes = 2000) => ({
    name: 'Meu Currículo.pdf', contentType: 'application/pdf',
    bytes: new Uint8Array([...new TextEncoder().encode('%PDF-1.7\n'), ...new Uint8Array(bytes)]),
  });
  const basic = (pw: string) => `Basic ${Buffer.from(`equipe:${pw}`).toString('base64')}`;

  it('aceita todas as disciplinas do 6º ano ao pré-vestibular, mestrado e doutorado', async () => {
    const names = WAITLIST_SUBJECTS.map((s) => s.name);
    for (const n of ['Matemática', 'Língua Portuguesa', 'Redação', 'Literatura', 'Física', 'Química', 'Biologia', 'Ciências',
      'História', 'Geografia', 'Filosofia', 'Sociologia', 'Inglês', 'Espanhol', 'Arte', 'Educação Física']) {
      expect(names).toContain(n);
    }
    expect(EDUCATION).toMatchObject({ mestrado: 'Mestrado', doutorado: 'Doutorado' });
    const ingles = WAITLIST_SUBJECTS.find((s) => s.name === 'Inglês')!.id;
    await joinTeacherWaitlist(deps(), entry({ subjectIds: [ingles], education: 'doutorado' }), NOW);
    const csv = await waitlistCsv(deps());
    expect(csv).toContain('Inglês');
    expect(csv).toContain('Doutorado');
    await expect(joinTeacherWaitlist(deps(), entry({ subjectIds: [999] }), NOW)).rejects.toThrow(/disciplina/);
  });

  it('guarda o currículo e a planilha traz o link, protegido pela mesma senha', async () => {
    await joinTeacherWaitlist(deps(), entry({ cv: pdf() }), NOW);
    const d = deps({ WAITLIST_EXPORT_PASSWORD: 'senha-longa-de-teste' });
    const csv = await waitlistCsv(d);
    const link = /(http\S+\/api\/lista-de-espera\/curriculo\/([0-9a-f-]{36}))/.exec(csv);
    expect(link).not.toBeNull();
    const id = link![2]!;
    expect((await serveWaitlistCv(d, null, id)).status).toBe(401);
    expect((await serveWaitlistCv(deps(), basic('qualquer'), id)).status).toBe(404);
    const ok = await serveWaitlistCv(d, basic('senha-longa-de-teste'), id);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe('application/pdf');
    expect(ok.headers.get('content-disposition')).toMatch(/attachment; filename="curriculo-ana-souza\.pdf"/);
    expect(ok.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await ok.arrayBuffer()).slice(0, 5)).toEqual(new TextEncoder().encode('%PDF-'));
    expect((await serveWaitlistCv(d, basic('senha-longa-de-teste'), 'nao-e-id')).status).toBe(404);
  });

  it('sem currículo, a coluna fica vazia; reenviar troca o currículo', async () => {
    await joinTeacherWaitlist(deps(), entry(), NOW);
    expect((await waitlistCsv(deps())).split('\r\n')[1]!.endsWith(',')).toBe(true);
    await joinTeacherWaitlist(deps(), entry({ cv: pdf(10) }), NOW);
    await joinTeacherWaitlist(deps(), entry({ cv: { ...pdf(20), name: 'novo.pdf' } }), NOW);
    expect(await q(`SELECT count(*)::int AS n FROM teacher_waitlist_cvs`)).toEqual([{ n: 1 }]);
  });

  it('recusa formato e tamanho errados, conferindo o conteúdo do arquivo', async () => {
    const exe = { name: 'curriculo.pdf', contentType: 'application/pdf', bytes: new Uint8Array([0x4d, 0x5a, 0, 0]) };
    await expect(joinTeacherWaitlist(deps(), entry({ cv: exe }), NOW)).rejects.toThrow(/PDF, DOC, DOCX ou ODT/);
    const txt = { name: 'curriculo.txt', contentType: 'text/plain', bytes: new TextEncoder().encode('oi') };
    await expect(joinTeacherWaitlist(deps(), entry({ cv: txt }), NOW)).rejects.toThrow(/PDF, DOC, DOCX ou ODT/);
    const big = pdf(5 * 1024 * 1024);
    await expect(joinTeacherWaitlist(deps(), entry({ cv: big }), NOW)).rejects.toThrow(/5 MB/);
    const docx = { name: 'cv.docx', contentType: '', bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]) };
    await joinTeacherWaitlist(deps(), entry({ cv: docx }), NOW);
    expect(await q(`SELECT content_type FROM teacher_waitlist_cvs`)).toEqual([
      { content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    ]);
  });
});

