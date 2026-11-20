/**
 * Mensagens entre o responsável e o professor: contatos sempre ocultos,
 * conversa só entre quem tem vínculo (a família pode começar; o professor
 * só responde), não lidas e aviso por e-mail no máximo a cada 15 minutos.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  conversations, hideContacts, notifyNewMessages, openThread, sendMessage, unreadTotal,
} from '@/domain/messages';
import { appDb, closeAppDb } from '../helpers/app';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { insertGuardian, insertTeacher } from '../helpers/fixtures';
import { NOW, testDeps } from '../helpers/scenario';

beforeEach(truncateAll);
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const q = async (text: string, params: unknown[] = []) => (await testPool().query(text, params)).rows;

async function teacher(name: string, status = 'approved') {
  const id = await insertTeacher(testPool(), { display_name: name });
  await q(`UPDATE teachers SET status = $2, email = $3 WHERE id = $1`, [id, status, `${name.split(' ')[0]!.toLowerCase()}@prof.com`]);
  return id;
}
async function guardian(name: string, email: string) {
  const id = await insertGuardian(testPool(), { name });
  await q(`UPDATE guardians SET email = $2 WHERE id = $1`, [id, email]);
  return id;
}
const outbox = (to: string) => q(`SELECT subject, body FROM dev_outbox WHERE recipient = $1 ORDER BY id`, [to]);

describe('contatos sempre ocultos', () => {
  it.each([
    'me liga no 11 98888-1111',
    'meu zap (11) 98888-1111',
    'whats +55 11 988881111',
    'chama no 11 9 8888 1111',
    'manda para maria.lima@gmail.com',
    'maria arroba gmail ponto com',
    'veja https://instagram.com/maria',
    'meu site www.mariaensina.com.br',
    'mariaensina.com.br tem tudo',
    'wa.me/5511988881111',
    'me segue @maria.prof',
  ])('“%s” esconde o contato', (text) => {
    const r = hideContacts(text);
    expect(r.hidden).toBe(true);
    expect(r.text).toContain('[contato oculto]');
    expect(r.text).not.toMatch(/8888|gmail|instagram|mariaensina|maria\.prof|wa\.me/);
  });

  it.each([
    'A aula é dia 24/11/2026, às 15h30.',
    'Ela está no 9º ano e tem prova de 2 capítulos na sexta.',
    'O pacote custa R$ 1.210,00 e a aula, R$ 121,00.',
    'Podemos das 14:00 às 15:00?',
  ])('“%s” passa como está', (text) => {
    expect(hideContacts(text)).toEqual({ text, hidden: false });
  });
});

describe('enviar', () => {
  it('a família escreve a um professor aprovado: cria o vínculo e guarda a mensagem com o contato oculto', async () => {
    const t = await teacher('Ana Souza');
    const g = await guardian('Maria Lima', 'maria@exemplo.com');
    expect(await sendMessage(testDeps(), { teacherId: t, guardianId: g, from: 'guardian', body: '  Oi! Meu zap é 11 98888-1111  ' }, NOW))
      .toEqual({ hidden: true });
    expect(await q(`SELECT acquisition FROM teacher_guardian_links`)).toEqual([{ acquisition: 'teacher_link' }]);
    const [m] = await q(`SELECT sender, body, masked, created_at FROM messages`);
    expect(m).toEqual({ sender: 'guardian', body: 'Oi! Meu zap é [contato oculto]', masked: true, created_at: new Date(NOW.epochMilliseconds) });
  });

  it('a primeira mensagem registra a origem da família; depois ela não muda', async () => {
    const t = await teacher('Ana Souza');
    const g = await guardian('Maria Lima', 'maria@exemplo.com');
    await sendMessage(testDeps(), { teacherId: t, guardianId: g, from: 'guardian', body: 'Oi', acquisition: 'marketplace' }, NOW);
    await sendMessage(testDeps(), { teacherId: t, guardianId: g, from: 'guardian', body: 'De novo', acquisition: 'teacher_link' }, NOW);
    expect(await q(`SELECT acquisition FROM teacher_guardian_links`)).toEqual([{ acquisition: 'marketplace' }]);
  });

  it('o professor não começa conversa; professor não aprovado não recebe; vazia e longa demais são recusadas', async () => {
    const t = await teacher('Ana Souza');
    const draft = await teacher('Bruno Lima', 'draft');
    const g = await guardian('Maria Lima', 'maria@exemplo.com');
    await expect(sendMessage(testDeps(), { teacherId: t, guardianId: g, from: 'teacher', body: 'Olá' }, NOW)).rejects.toThrow('conversa não encontrada');
    await expect(sendMessage(testDeps(), { teacherId: draft, guardianId: g, from: 'guardian', body: 'Olá' }, NOW)).rejects.toThrow('professor não encontrado');
    await expect(sendMessage(testDeps(), { teacherId: t, guardianId: g, from: 'guardian', body: '   ' }, NOW)).rejects.toThrow('escreva a mensagem');
    await expect(sendMessage(testDeps(), { teacherId: t, guardianId: g, from: 'guardian', body: 'a'.repeat(2001) }, NOW)).rejects.toThrow('2.000');
    expect(await q(`SELECT count(*)::int AS n FROM messages`)).toEqual([{ n: 0 }]);
  });
});

describe('conversas e não lidas', () => {
  it('cada lado vê a lista, a mais recente primeiro, com as não lidas; abrir marca como lida', async () => {
    const ana = await teacher('Ana Souza');
    const bia = await teacher('Bia Costa');
    const g = await guardian('Maria Lima', 'maria@exemplo.com');
    await sendMessage(testDeps(), { teacherId: ana, guardianId: g, from: 'guardian', body: 'Oi, Ana' }, NOW);
    await sendMessage(testDeps(), { teacherId: bia, guardianId: g, from: 'guardian', body: 'Oi, Bia' }, NOW.add({ minutes: 1 }));
    await sendMessage(testDeps(), { teacherId: ana, guardianId: g, from: 'teacher', body: 'Oi, Maria!' }, NOW.add({ minutes: 2 }));
    await sendMessage(testDeps(), { teacherId: ana, guardianId: g, from: 'teacher', body: 'Tudo bem?' }, NOW.add({ minutes: 3 }));

    const mine = await conversations(appDb(), { kind: 'guardian', id: g });
    expect(mine.map((c) => [c.name, c.lastBody, c.lastFromMe, c.unread])).toEqual([
      ['Ana Souza', 'Tudo bem?', false, 2],
      ['Bia Costa', 'Oi, Bia', true, 0],
    ]);
    expect(await unreadTotal(appDb(), { kind: 'guardian', id: g })).toBe(2);
    const ana1 = await conversations(appDb(), { kind: 'teacher', id: ana });
    expect(ana1.map((c) => [c.name, c.unread])).toEqual([['Maria L.', 0]]); // a professora respondeu depois: já leu

    const thread = await openThread(appDb(), { teacherId: ana, guardianId: g }, 'guardian', NOW.add({ minutes: 4 }));
    expect(thread!.map((m) => [m.sender, m.body])).toEqual([['guardian', 'Oi, Ana'], ['teacher', 'Oi, Maria!'], ['teacher', 'Tudo bem?']]);
    expect(await unreadTotal(appDb(), { kind: 'guardian', id: g })).toBe(0);
    expect(await openThread(appDb(), { teacherId: ana, guardianId: await guardian('Outra', 'o@x.com') }, 'guardian', NOW)).toBeNull();
  });
});

describe('aviso de mensagem nova', () => {
  it('um aviso em 15 minutos, sem o texto; nada se já leu; de novo depois de 15 minutos', async () => {
    const t = await teacher('Ana Souza');
    const g = await guardian('Maria Lima', 'maria@exemplo.com');
    const to = { teacherId: t, guardianId: g, to: 'teacher' as const };
    await sendMessage(testDeps(), { teacherId: t, guardianId: g, from: 'guardian', body: 'Segredo da prova' }, NOW);
    expect(await notifyNewMessages(testDeps(), to, NOW)).toBe(true);
    const [mail] = await outbox('ana@prof.com');
    expect(mail!.subject).toBe('Nova mensagem de Maria L. na Reforce');
    expect(mail!.body).not.toContain('Segredo');
    expect(mail!.body).toContain('/professor/mensagens/');

    await sendMessage(testDeps(), { teacherId: t, guardianId: g, from: 'guardian', body: 'Outra' }, NOW.add({ minutes: 5 }));
    expect(await notifyNewMessages(testDeps(), to, NOW.add({ minutes: 5 }))).toBe(false); // dentro dos 15 minutos
    await openThread(appDb(), { teacherId: t, guardianId: g }, 'teacher', NOW.add({ minutes: 6 }));
    expect(await notifyNewMessages(testDeps(), to, NOW.add({ minutes: 30 }))).toBe(false); // já leu

    await sendMessage(testDeps(), { teacherId: t, guardianId: g, from: 'guardian', body: 'E agora?' }, NOW.add({ minutes: 40 }));
    expect(await notifyNewMessages(testDeps(), to, NOW.add({ minutes: 40 }))).toBe(true);
    expect(await outbox('ana@prof.com')).toHaveLength(2);
  });

  it('o aviso para a família leva o link da conversa com o professor', async () => {
    const t = await teacher('Ana Souza');
    const slug = (await q(`SELECT slug FROM teachers WHERE id = $1`, [t]))[0]!.slug as string;
    const g = await guardian('Maria Lima', 'maria@exemplo.com');
    await sendMessage(testDeps(), { teacherId: t, guardianId: g, from: 'guardian', body: 'Oi' }, NOW);
    await sendMessage(testDeps(), { teacherId: t, guardianId: g, from: 'teacher', body: 'Olá!' }, NOW.add({ minutes: 1 }));
    expect(await notifyNewMessages(testDeps(), { teacherId: t, guardianId: g, to: 'guardian' }, NOW.add({ minutes: 1 }))).toBe(true);
    const [mail] = await outbox('maria@exemplo.com');
    expect(mail!.subject).toBe('Nova mensagem de Ana Souza na Reforce');
    expect(mail!.body).toContain(`/conta/mensagens/${slug}`);
  });
});
