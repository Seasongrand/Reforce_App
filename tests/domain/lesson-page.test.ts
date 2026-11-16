/**
 * Página da aula para a família (o aluno não tem login): aberta só por link
 * assinado e dentro da validade; ferramentas de desenvolvimento desligadas
 * fora de DEV_TOOLS=1.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { lessonPageView } from '@/domain/lessons/page';
import { lessonToken } from '@/domain/lessons/links';
import { devToolsEnabled } from '@/domain/dev';
import { closeAppDb, testConfig } from '../helpers/app';
import { closeTestPool, truncateAll } from '../helpers/db';
import { NOW, paidLesson, testDeps, TUE_14 } from '../helpers/scenario';

beforeEach(truncateAll);
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = () => testDeps();
const secret = () => deps().config.sessionSecret;

describe('página da aula pelo link da família', () => {
  it('link válido mostra a aula; a sala só abre perto do horário', async () => {
    const l = await paidLesson();
    const token = lessonToken(l.bookingId, 'student', TUE_14.add({ hours: 25 }), secret());
    const early = await lessonPageView(deps(), token, NOW);
    expect(early).toMatchObject({
      bookingId: l.bookingId, modality: 'online', teacherName: 'Ana Souza', studentFirstName: 'Joana', status: 'confirmed',
      roomOpen: false,
    });
    expect((await lessonPageView(deps(), token, TUE_14.subtract({ minutes: 5 })))!.roomOpen).toBe(true);
    expect(JSON.stringify(early)).not.toContain('+5511977776666');
  });

  it('presencial mostra o código da aula e o endereço certo', async () => {
    const l = await paidLesson({ service: { modality: 'at_teacher' } });
    const v = await lessonPageView(deps(), lessonToken(l.bookingId, 'student', TUE_14.add({ hours: 25 }), secret()), NOW);
    expect(v!.checkinCode).toMatch(/^\d{6}$/);
    expect(v!.address).toBe('Rua das Flores, 100, Pinheiros');
  });

  it('link adulterado ou vencido é recusado', async () => {
    const l = await paidLesson();
    const token = lessonToken(l.bookingId, 'student', TUE_14.add({ hours: 25 }), secret());
    const [body, sig] = token.split('.');
    expect(await lessonPageView(deps(), `${body}.${sig!.replace(/^./, sig![0] === 'a' ? 'b' : 'a')}`, NOW)).toBeNull();
    const forged = Buffer.from(`${l.bookingId}|student|9999999999`).toString('base64url');
    expect(await lessonPageView(deps(), `${forged}.${sig}`, NOW)).toBeNull();
    expect(await lessonPageView(deps(), token, TUE_14.add({ hours: 26 }))).toBeNull();
    expect(await lessonPageView(deps(), 'lixo', NOW)).toBeNull();
  });
});

describe('ferramentas de desenvolvimento', () => {
  it('só existem com DEV_TOOLS=1 e adaptadores falsos', () => {
    expect(devToolsEnabled(testConfig({ DEV_TOOLS: '1' }))).toBe(true);
    expect(devToolsEnabled(testConfig({ DEV_TOOLS: '0' }))).toBe(false);
  });
});
