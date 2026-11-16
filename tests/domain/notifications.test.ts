/**
 * Textos e envio das mensagens (§1 passo 7, §3.5): transacionais, no fuso de
 * quem lê, com os dois horários quando diferem; o envio respeita o horário
 * agendado e não duplica.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { loadMessageContext, render } from '@/domain/notifications/templates';
import { sendDueNotifications } from '@/domain/notifications/send';
import { checkinCode } from '@/domain/lessons/checkin';
import { appDb, closeAppDb } from '../helpers/app';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { NOW, paidLesson, testDeps, TUE_14 } from '../helpers/scenario';

beforeEach(truncateAll);
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = () => testDeps();
const outbox = async () =>
  (await testPool().query(`SELECT channel, recipient, template, subject, body FROM dev_outbox ORDER BY id`)).rows as Array<{
    channel: string; recipient: string; template: string | null; subject: string | null; body: string;
  }>;

describe('textos', () => {
  it('confirmação da família, online, responsável em Manaus: dois horários e link da sala', async () => {
    const l = await paidLesson({ guardianTz: 'America/Manaus' });
    const ctx = await loadMessageContext(deps(), l.bookingId);
    const m = render('confirmacao_responsavel', ctx);
    expect(m.email.subject).toContain('Aula confirmada');
    expect(m.email.text).toContain('Joana');
    expect(m.email.text).toContain('Ana Souza');
    expect(m.email.text).toContain('13:00');
    expect(m.email.text).toContain('Manaus');
    expect(m.email.text).toContain('14:00');
    expect(m.email.text).toContain('http://localhost:3000/aula/');
    expect(m.email.text).not.toContain('+5511977776666'); // telefone do professor nunca vai para a família
    expect(m.whatsapp.name).toBe('confirmacao_responsavel');
  });

  it('confirmação presencial no endereço do professor: endereço e código da aula', async () => {
    const l = await paidLesson({ service: { modality: 'at_teacher' } });
    const m = render('confirmacao_responsavel', await loadMessageContext(deps(), l.bookingId));
    expect(m.email.text).toContain('Rua das Flores, 100, Pinheiros');
    expect(m.email.text).toContain(checkinCode(l.bookingId, deps().config.sessionSecret));
  });

  it('confirmação ao professor de aula na casa do aluno: endereço da família, sem contato dela', async () => {
    const l = await paidLesson({ service: { modality: 'at_student' }, withAddress: true });
    const ctx = await loadMessageContext(deps(), l.bookingId);
    const m = render('confirmacao_professor', ctx);
    expect(m.email.text).toContain('Av. Paulista, 1000');
    expect(m.email.text).toContain('Joana');
    expect(m.email.text).not.toContain(ctx.guardian.phone);
    expect(m.email.text).not.toContain(ctx.guardian.email ?? '@@');
  });

  it('valores em reais no aviso de devolução', async () => {
    const l = await paidLesson();
    const m = render('pagamento_tardio_reembolso', await loadMessageContext(deps(), l.bookingId));
    expect(m.email.text).toContain('R$ 121,00');
    expect(m.email.text).toContain('http://localhost:3000/p/');
  });
});

describe('envio', () => {
  it('na hora da confirmação envia as confirmações; na véspera, só o lembrete de 24 h, uma vez', async () => {
    const l = await paidLesson();
    await sendDueNotifications(deps(), NOW.add({ minutes: 1 }));
    const first = await outbox();
    expect(first.map((m) => `${m.channel}:${m.template ?? m.subject}`).sort()).toEqual(
      [
        'email:Aula confirmada: matemática com Ana Souza',
        'email:Nova aula paga: Joana, terça-feira, 17 de novembro, 14:00',
        'whatsapp:confirmacao_professor',
        'whatsapp:confirmacao_responsavel',
      ].sort(),
    );

    const dayBefore = TUE_14.subtract({ hours: 24 });
    await Promise.all([sendDueNotifications(deps(), dayBefore), sendDueNotifications(deps(), dayBefore)]);
    const after = (await outbox()).slice(first.length);
    expect(after.map((m) => m.channel).sort()).toEqual(['email', 'whatsapp']);
    expect(after.every((m) => (m.template ?? m.subject ?? '').match(/lembrete_24h|amanhã/i))).toBe(true);
    const states = await testPool().query(
      `SELECT template, status FROM notifications WHERE booking_id = $1 ORDER BY template, channel`,
      [l.bookingId],
    );
    expect(states.rows.filter((r) => r.status === 'scheduled').map((r) => r.template)).toEqual([
      'lembrete_1h_responsavel', 'lembrete_1h_responsavel',
    ]);
  });

  it('lembrete de aula que não está mais confirmada é cancelado, não enviado', async () => {
    const l = await paidLesson();
    await sendDueNotifications(deps(), NOW.add({ minutes: 1 }));
    await testPool().query(`UPDATE bookings SET status = 'cancelled' WHERE id = $1`, [l.bookingId]);
    const before = (await outbox()).length;
    await sendDueNotifications(deps(), TUE_14.subtract({ minutes: 59 }));
    expect((await outbox()).length).toBe(before);
    const { rows } = await testPool().query(`SELECT DISTINCT status FROM notifications WHERE template LIKE 'lembrete%'`);
    expect(rows).toEqual([{ status: 'cancelled' }]);
  });

  it('mensagem não vence antes da hora', async () => {
    await paidLesson();
    await sendDueNotifications(deps(), NOW);
    expect(await outbox()).toEqual([]);
  });
});
