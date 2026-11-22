/**
 * Agendamento das mensagens na confirmação (§1, passo 7): confirmação agora,
 * lembretes de 24 h e 1 h; WhatsApp só com aceite, e-mail sempre como cópia.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { scheduleForConfirmedBooking } from '@/domain/notifications/schedule';
import { appDb, closeAppDb } from '../helpers/app';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { insertBooking, insertFamilyOrder } from '../helpers/fixtures';
import { listedTeacher, NOW } from '../helpers/scenario';

beforeEach(truncateAll);
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

async function confirmedBooking(startsAt: string, o: { guardianOptIn: boolean; teacherOptIn: boolean }) {
  const t = await listedTeacher();
  await testPool().query(
    `UPDATE teachers SET phone_e164 = '+5511977776666', whatsapp_opt_in_at = CASE WHEN $2 THEN now() END WHERE id = $1`,
    [t.teacherId, o.teacherOptIn],
  );
  const fam = await insertFamilyOrder(testPool(), t.teacherId, t.serviceId);
  await testPool().query(
    `UPDATE guardians SET email = 'familia@exemplo.com', whatsapp_opt_in_at = CASE WHEN $2 THEN now() END WHERE id = $1`,
    [fam.guardianId, o.guardianOptIn],
  );
  const bookingId = await insertBooking(testPool(), { ...fam, ...t, startsAt });
  return bookingId;
}

const rows = async (bookingId: string) =>
  (await testPool().query(
    `SELECT template, channel, send_at FROM notifications WHERE booking_id = $1 ORDER BY template, channel`,
    [bookingId],
  )).rows as Array<{ template: string; channel: string; send_at: Date }>;

describe('agendamento na confirmação', () => {
  it('com aceite dos dois lados: 3 modelos da família × 2 canais + 3 do professor × 2 = 12', async () => {
    const id = await confirmedBooking('2026-11-19 14:00-03', { guardianOptIn: true, teacherOptIn: true });
    await appDb().transaction().execute((trx) => scheduleForConfirmedBooking(trx, id, NOW));
    const r = await rows(id);
    expect(r.map((x) => `${x.template}/${x.channel}`)).toEqual([
      'confirmacao_professor/email', 'confirmacao_professor/whatsapp',
      'confirmacao_responsavel/email', 'confirmacao_responsavel/whatsapp',
      'lembrete_1h_professor/email', 'lembrete_1h_professor/whatsapp',
      'lembrete_1h_responsavel/email', 'lembrete_1h_responsavel/whatsapp',
      'lembrete_24h_professor/email', 'lembrete_24h_professor/whatsapp',
      'lembrete_24h_responsavel/email', 'lembrete_24h_responsavel/whatsapp',
    ]);
    const at = (tpl: string) => r.find((x) => x.template === tpl)!.send_at.toISOString();
    expect(at('lembrete_24h_responsavel')).toBe('2026-11-18T17:00:00.000Z');
    expect(at('lembrete_1h_responsavel')).toBe('2026-11-19T16:00:00.000Z');
    expect(at('lembrete_24h_professor')).toBe('2026-11-18T17:00:00.000Z');
    expect(at('lembrete_1h_professor')).toBe('2026-11-19T16:00:00.000Z');
    expect(at('confirmacao_responsavel')).toBe(NOW.toString().replace('Z', '.000Z'));
  });

  it('sem aceite de WhatsApp da família: só e-mail para ela (3 + 6 do professor = 9)', async () => {
    const id = await confirmedBooking('2026-11-19 14:00-03', { guardianOptIn: false, teacherOptIn: true });
    await appDb().transaction().execute((trx) => scheduleForConfirmedBooking(trx, id, NOW));
    expect(await rows(id)).toHaveLength(9);
  });

  it('aula daqui a 5 horas: o lembrete de 24 h não é criado', async () => {
    const id = await confirmedBooking('2026-11-16 13:00-03', { guardianOptIn: true, teacherOptIn: false });
    await appDb().transaction().execute((trx) => scheduleForConfirmedBooking(trx, id, NOW));
    const templates = new Set((await rows(id)).map((x) => x.template));
    expect(templates.has('lembrete_24h_responsavel')).toBe(false);
    expect(templates.has('lembrete_24h_professor')).toBe(false);
    expect(templates.has('lembrete_1h_responsavel')).toBe(true);
    expect(templates.has('lembrete_1h_professor')).toBe(true);
  });

  it('agendar duas vezes não duplica', async () => {
    const id = await confirmedBooking('2026-11-19 14:00-03', { guardianOptIn: true, teacherOptIn: true });
    await appDb().transaction().execute((trx) => scheduleForConfirmedBooking(trx, id, NOW));
    await appDb().transaction().execute((trx) => scheduleForConfirmedBooking(trx, id, NOW));
    expect(await rows(id)).toHaveLength(12);
  });
});
