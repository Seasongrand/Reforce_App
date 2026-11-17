/**
 * Página da equipe: resumo das listas de espera (professores e alunos) por
 * cidade e disciplina, e as listas com filtros.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { joinStudentWaitlist } from '@/domain/student-waitlist';
import { teamOverview } from '@/domain/team-view';
import { joinTeacherWaitlist, type WaitlistInput } from '@/domain/waitlist';
import { closeAppDb } from '../helpers/app';
import { closeTestPool, truncateAll } from '../helpers/db';
import { NOW, testDeps } from '../helpers/scenario';

beforeEach(truncateAll);
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = () => testDeps();
const pdf = { name: 'cv.pdf', contentType: 'application/pdf', bytes: new TextEncoder().encode('%PDF-1.7\n') };
const teacher = (over: Partial<WaitlistInput>): WaitlistInput => ({
  name: 'Ana Souza', email: 'ana@exemplo.com', phone: '(21) 97777-6666', city: 'Niterói', state: 'RJ', subjectIds: [1],
  stages: ['medio'], modalities: ['online'], education: 'mestrado', notes: 'Dou aula há 5 anos.', consent: true, ...over,
});

async function seed() {
  await joinTeacherWaitlist(deps(), teacher({ cv: pdf }), NOW);
  await joinTeacherWaitlist(deps(), teacher({ name: 'Bruno Lima', email: 'bruno@exemplo.com', phone: '', city: 'niteroi ', subjectIds: [1, 13], notes: '' }), NOW.add({ hours: 1 }));
  await joinTeacherWaitlist(deps(), teacher({ name: 'Carla Dias', email: 'carla@exemplo.com', city: 'São Paulo', state: 'SP', subjectIds: [2] }), NOW.add({ hours: 2 }));
  await joinStudentWaitlist(deps(), { email: 'mae@exemplo.com', city: 'Niterói', state: 'RJ', subjectIds: [1], stages: ['fund2'], adultConsent: true }, NOW);
  await joinStudentWaitlist(deps(), { email: 'pai@exemplo.com', city: 'Campinas', state: 'SP', subjectIds: [13], stages: ['medio'], adultConsent: true }, NOW.add({ hours: 1 }));
}

describe('resumo da equipe', () => {
  it('conta professores, alunos e currículos, e agrupa por cidade (sem diferença de acento e maiúscula) e disciplina; no empate, quem tem mais professores vem antes', async () => {
    await seed();
    const v = await teamOverview(deps(), {});
    expect(v.totals).toEqual({ teachers: 3, students: 2, withCv: 1 });
    expect(v.byCity).toEqual([
      { city: 'Niterói', state: 'RJ', teachers: 2, students: 1 },
      { city: 'São Paulo', state: 'SP', teachers: 1, students: 0 },
      { city: 'Campinas', state: 'SP', teachers: 0, students: 1 },
    ]);
    expect(v.bySubject).toEqual([
      { subject: 'Matemática', teachers: 2, students: 1 },
      { subject: 'Inglês', teachers: 1, students: 1 },
      { subject: 'Física', teachers: 1, students: 0 },
    ]);
    expect(v.states).toEqual(['RJ', 'SP']);
  });

  it('lista os professores do mais novo ao mais antigo, com contato, nomes e o link do currículo', async () => {
    await seed();
    const v = await teamOverview(deps(), {});
    expect(v.teachers.map((t) => t.name)).toEqual(['Carla Dias', 'Bruno Lima', 'Ana Souza']);
    const ana = v.teachers.find((t) => t.name === 'Ana Souza')!;
    expect(ana).toMatchObject({
      email: 'ana@exemplo.com', phone: '+5521977776666', whatsappUrl: 'https://wa.me/5521977776666', city: 'Niterói', state: 'RJ',
      subjects: ['Matemática'], stages: ['Ensino médio'], modalities: ['Online'], education: 'Mestrado', notes: 'Dou aula há 5 anos.',
    });
    expect(ana.cvUrl).toMatch(/^\/api\/lista-de-espera\/curriculo\/[0-9a-f-]{36}$/);
    const bruno = v.teachers.find((t) => t.name === 'Bruno Lima')!;
    expect(bruno).toMatchObject({ phone: null, whatsappUrl: null, cvUrl: null, notes: null });
    expect(v.students.map((s) => s.email)).toEqual(['pai@exemplo.com', 'mae@exemplo.com']);
    expect(v.students[1]).toMatchObject({ city: 'Niterói', state: 'RJ', subjects: ['Matemática'], stages: ['Fundamental 2 (6º ao 9º ano)'] });
  });

  it('filtra as listas por busca (sem acento), UF e disciplina; o resumo continua com todos', async () => {
    await seed();
    const byText = await teamOverview(deps(), { q: 'NITEROI' });
    expect(byText.teachers.map((t) => t.name)).toEqual(['Bruno Lima', 'Ana Souza']);
    expect(byText.students.map((s) => s.email)).toEqual(['mae@exemplo.com']);
    expect(byText.totals.teachers).toBe(3);
    expect((await teamOverview(deps(), { q: 'carla@' })).teachers.map((t) => t.name)).toEqual(['Carla Dias']);
    const sp = await teamOverview(deps(), { uf: 'sp' });
    expect(sp.teachers.map((t) => t.name)).toEqual(['Carla Dias']);
    expect(sp.students.map((s) => s.email)).toEqual(['pai@exemplo.com']);
    const ingles = await teamOverview(deps(), { subjectId: 13 });
    expect(ingles.teachers.map((t) => t.name)).toEqual(['Bruno Lima']);
    expect(ingles.students.map((s) => s.email)).toEqual(['pai@exemplo.com']);
  });

  it('mostra a cidade com a grafia da inscrição mais antiga, seja de professor ou de aluno', async () => {
    await joinStudentWaitlist(deps(), { email: 'mae@exemplo.com', city: 'Petrópolis', state: 'RJ', subjectIds: [1], stages: ['fund2'], adultConsent: true }, NOW);
    await joinTeacherWaitlist(deps(), teacher({ city: 'petropolis' }), NOW.add({ hours: 1 }));
    expect((await teamOverview(deps(), {})).byCity).toEqual([{ city: 'Petrópolis', state: 'RJ', teachers: 1, students: 1 }]);
  });

  it('sem inscrições, tudo zerado', async () => {
    const v = await teamOverview(deps(), {});
    expect(v).toMatchObject({ totals: { teachers: 0, students: 0, withCv: 0 }, byCity: [], bySubject: [], states: [], teachers: [], students: [] });
  });
});
