/**
 * Reserva temporária pela aplicação (§2.4): trava por professor, limpeza no
 * caminho, revalidação e INSERT; 23P01 vira "ocupado".
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Temporal } from 'temporal-polyfill';
import { sql } from 'kysely';
import { holdSlots, type HoldRequest } from '@/domain/booking/hold';
import { startPayment } from '@/domain/payment/charge';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { appDb, closeAppDb } from '../helpers/app';
import { freeSlots, insertBooking, insertFamilyOrder, northOf } from '../helpers/fixtures';
import { activeBookings, at, family, listedTeacher, NOW, testDeps, TUE_14 } from '../helpers/scenario';

beforeEach(truncateAll);
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = () => testDeps();

async function request(
  t: { teacherId: string; serviceId: string },
  over: Partial<HoldRequest> = {},
  fam?: Awaited<ReturnType<typeof family>>,
): Promise<HoldRequest> {
  const f = fam ?? (await family());
  return {
    teacherId: t.teacherId, serviceId: t.serviceId, guardianId: f.guardianId, studentId: f.studentId,
    addressId: f.addressId, startsAt: [TUE_14], idempotencyKey: randomUUID(), ...over,
  };
}

describe('holdSlots', () => {
  it('prende o horário por 10 minutos e grava pedido com comissão do link (5%)', async () => {
    const t = await listedTeacher();
    const r = await holdSlots(deps(), await request(t), NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.holdExpiresAt.toString()).toBe(NOW.add({ minutes: 10 }).toString());
    const { rows } = await testPool().query(
      `SELECT o.commission_bps, o.total_cents, o.status, b.status AS b_status, b.local_start::text, b.timezone
         FROM orders o JOIN bookings b ON b.order_id = o.id WHERE o.id = $1`,
      [r.orderId],
    );
    expect(rows[0]).toEqual({
      commission_bps: 500, total_cents: 12100, status: 'awaiting_payment', b_status: 'held',
      local_start: '2026-11-17 14:00:00', timezone: 'America/Sao_Paulo',
    });
    const link = await testPool().query(`SELECT acquisition FROM teacher_guardian_links WHERE teacher_id = $1`, [t.teacherId]);
    expect(link.rows).toEqual([{ acquisition: 'teacher_link' }]);
  });

  it('20 reservas simultâneas no mesmo horário: 1 ok e 19 "ocupado", sem exceção', async () => {
    const t = await listedTeacher();
    const reqs = [];
    for (let i = 0; i < 20; i++) reqs.push(await request(t));
    const results = await Promise.all(reqs.map((r) => holdSlots(deps(), r, NOW)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.reason === 'ocupado')).toHaveLength(19);
    expect(await activeBookings(t.teacherId)).toBe(1);
  });

  it('mesma chave de idempotência duas vezes devolve o mesmo pedido e uma reserva só', async () => {
    const t = await listedTeacher();
    const req = await request(t);
    const [a, b] = await Promise.all([holdSlots(deps(), req, NOW), holdSlots(deps(), req, NOW)]);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.orderId).toBe(b.orderId);
    expect(await activeBookings(t.teacherId)).toBe(1);
  });

  it('horário fora da grade é indisponível', async () => {
    const t = await listedTeacher();
    const r = await holdSlots(deps(), await request(t, { startsAt: [at('2026-11-17T17:10:00Z')] }), NOW);
    expect(r).toMatchObject({ ok: false, reason: 'indisponivel' });
  });

  it('fere a antecedência mínima', async () => {
    const t = await listedTeacher();
    const r = await holdSlots(deps(), await request(t), TUE_14.subtract({ minutes: 60 }));
    expect(r).toMatchObject({ ok: false, reason: 'antecedencia' });
  });

  it('limite diário de 1 aula com uma aula já vendida no dia', async () => {
    const t = await listedTeacher({ maxLessonsPerDay: 1 });
    const fam = await insertFamilyOrder(testPool(), t.teacherId, t.serviceId);
    await insertBooking(testPool(), { ...fam, ...t, startsAt: '2026-11-17 16:00-03' });
    const r = await holdSlots(deps(), await request(t), NOW);
    expect(r).toMatchObject({ ok: false, reason: 'limite_diario' });
  });

  it('professor com certidão vencida não vende pelo link', async () => {
    const t = await listedTeacher({ criminalRecordExpired: true });
    const r = await holdSlots(deps(), await request(t), NOW);
    expect(r).toMatchObject({ ok: false, reason: 'professor_indisponivel' });
  });

  it('professor sem conta de recebimento ativa não vende', async () => {
    const t = await listedTeacher({ withPaymentAccount: false });
    const r = await holdSlots(deps(), await request(t), NOW);
    expect(r).toMatchObject({ ok: false, reason: 'professor_indisponivel' });
  });

  it('pacote de 4 semanas com conflito na terceira: ocupado e nada gravado', async () => {
    const t = await listedTeacher();
    const other = await insertFamilyOrder(testPool(), t.teacherId, t.serviceId);
    await insertBooking(testPool(), { ...other, ...t, startsAt: '2026-12-01 14:00-03' });
    const starts = [0, 1, 2, 3].map((k) =>
      Temporal.PlainDateTime.from('2026-11-17T14:00').add({ weeks: k }).toZonedDateTime('America/Sao_Paulo').toInstant(),
    );
    const r = await holdSlots(deps(), await request(t, { startsAt: starts }), NOW);
    expect(r).toMatchObject({ ok: false, reason: 'ocupado' });
    expect(await activeBookings(t.teacherId)).toBe(1);
    const orders = await testPool().query(`SELECT count(*)::int AS n FROM orders`);
    expect(orders.rows[0]!.n).toBe(1); // só o pedido da outra família
  });

  it('"ocupado" traz horários alternativos, todos livres de verdade', async () => {
    const t = await listedTeacher();
    expect((await holdSlots(deps(), await request(t), NOW)).ok).toBe(true);
    const r = await holdSlots(deps(), await request(t), NOW);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.alternatives.length).toBeGreaterThan(0);
    expect(r.alternatives.length).toBeLessThanOrEqual(5);
    const free = await freeSlots(testPool(), t.teacherId, t.serviceId, '2026-11-15', '2026-12-31', NOW.toString());
    for (const a of r.alternatives) expect(free).toContain(new Date(a.epochMilliseconds).toISOString());
    expect(r.alternatives[0]!.toString()).toBe('2026-11-17T18:00:00Z'); // o mais próximo: 15h
  });

  it('mudar preço e duração do serviço depois da reserva não altera pedido nem aula', async () => {
    const t = await listedTeacher();
    const r = await holdSlots(deps(), await request(t), NOW);
    if (!r.ok) throw new Error('esperava reserva');
    await testPool().query(`UPDATE services SET price_cents = 20000, duration_min = 90 WHERE id = $1`, [t.serviceId]);
    const { rows } = await testPool().query(
      `SELECT o.total_cents, b.ends_at - b.starts_at AS dur FROM orders o JOIN bookings b ON b.order_id = o.id WHERE o.id = $1`,
      [r.orderId],
    );
    expect(rows[0]!.total_cents).toBe(12100);
    expect(rows[0]!.dur).toMatchObject({ hours: 1 });
  });

  describe('aula na casa do aluno', () => {
    const service = { modality: 'at_student' as const, buffer_before_min: 30, buffer_after_min: 30 };
    const base = { lat: -23.55, lng: -46.63 };

    it('exige endereço da família', async () => {
      const t = await listedTeacher({ service, ...base, radiusKm: 5 });
      await expect(holdSlots(deps(), await request(t), NOW)).rejects.toThrow(/endereço/);
    });

    it('recusa endereço fora do raio do professor', async () => {
      const t = await listedTeacher({ service, ...base, radiusKm: 5 });
      const fam = await family({ withAddress: true, lat: northOf(base.lat, 10.1), lng: base.lng });
      const r = await holdSlots(deps(), await request(t, {}, fam), NOW);
      expect(r).toMatchObject({ ok: false, reason: 'fora_do_raio' });
    });

    it('aceita endereço dentro do raio e grava o intervalo de deslocamento', async () => {
      const t = await listedTeacher({ service, ...base, radiusKm: 5 });
      const fam = await family({ withAddress: true, lat: northOf(base.lat, 2.9), lng: base.lng });
      const r = await holdSlots(deps(), await request(t, {}, fam), NOW);
      expect(r.ok).toBe(true);
      const { rows } = await testPool().query(
        `SELECT modality, address_id, lower(blocked) = starts_at - interval '30 minutes' AS buffered FROM bookings`,
      );
      expect(rows[0]).toEqual({ modality: 'at_student', address_id: fam.addressId, buffered: true });
    });

    it('não aceita endereço de outra família', async () => {
      const t = await listedTeacher({ service, ...base, radiusKm: 5 });
      const other = await family({ withAddress: true, lat: base.lat, lng: base.lng });
      const fam = await family();
      await expect(holdSlots(deps(), await request(t, { addressId: other.addressId }, fam), NOW)).rejects.toThrow(
        /endereço/,
      );
    });
  });

  describe('calendário externo', () => {
    async function connect(teacherId: string) {
      await testPool().query(`INSERT INTO calendar_connections (teacher_id, provider) VALUES ($1, 'fake')`, [teacherId]);
    }

    it('compromisso no Google, consultado antes da transação, torna o horário indisponível', async () => {
      const t = await listedTeacher();
      await connect(t.teacherId);
      await testPool().query(
        `INSERT INTO dev_calendar_busy (teacher_id, during) VALUES ($1, tstzrange('2026-11-17 14:30-03', '2026-11-17 15:00-03'))`,
        [t.teacherId],
      );
      const r = await holdSlots(deps(), await request(t), NOW);
      expect(r).toMatchObject({ ok: false, reason: 'indisponivel' });
    });

    it('Google fora do ar: reserva segue com o último dado e o professor é avisado', async () => {
      const t = await listedTeacher();
      await connect(t.teacherId);
      const r = await holdSlots(testDeps({ FAKE_FAIL: 'freeBusy' }), await request(t), NOW);
      expect(r.ok).toBe(true);
      const conn = await testPool().query(`SELECT last_error FROM calendar_connections WHERE teacher_id = $1`, [t.teacherId]);
      expect(conn.rows[0]!.last_error).toMatch(/simulada/);
      const out = await sql<{ subject: string }>`SELECT subject FROM dev_outbox WHERE channel = 'email'`.execute(appDb());
      expect(out.rows.map((x) => x.subject)).toEqual([expect.stringMatching(/calendário/i)]);
      // segundo erro seguido não manda outro aviso
      await holdSlots(testDeps({ FAKE_FAIL: 'freeBusy' }), await request(t, { startsAt: [TUE_14.add({ hours: 2 })] }), NOW);
      const out2 = await sql`SELECT 1 FROM dev_outbox WHERE channel = 'email'`.execute(appDb());
      expect(out2.rows).toHaveLength(1);
    });
  });
});

describe('origem da família na reserva', () => {
  it('família que veio da busca paga a comissão da busca (15%); o primeiro vínculo prevalece', async () => {
    const t = await listedTeacher();
    const fam = await family();
    const r = await holdSlots(deps(), await request(t, { acquisition: 'marketplace' }, fam), NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { rows } = await testPool().query(`SELECT commission_bps FROM orders WHERE id = $1`, [r.orderId]);
    expect(rows).toEqual([{ commission_bps: 1500 }]);
    // a segunda reserva, mesmo marcada como vinda do link, mantém a origem registrada na primeira
    const r2 = await holdSlots(deps(), await request(t, { acquisition: 'teacher_link', startsAt: [TUE_14.add({ hours: 2 })] }, fam), NOW);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect((await testPool().query(`SELECT commission_bps FROM orders WHERE id = $1`, [r2.orderId])).rows).toEqual([{ commission_bps: 1500 }]);
  });
});

describe('startPayment', () => {
  it('cria a cobrança com divisão e retenção, expira 1 minuto antes da reserva e congela a taxa', async () => {
    const t = await listedTeacher();
    const f = await family();
    const r = await holdSlots(deps(), await request(t, {}, f), NOW);
    if (!r.ok) throw new Error('esperava reserva');
    const p = await startPayment(deps(), { orderId: r.orderId, guardianId: f.guardianId, method: 'pix' }, NOW);
    expect(p.expiresAt.toString()).toBe(r.holdExpiresAt.subtract({ minutes: 1 }).toString());
    expect(p.checkoutData.pix?.qrPayload).toBeTruthy();
    const { rows } = await testPool().query(
      `SELECT method, amount_cents, platform_fee_cents, status FROM payments WHERE order_id = $1`,
      [r.orderId],
    );
    expect(rows).toEqual([{ method: 'pix', amount_cents: 12100, platform_fee_cents: 605, status: 'pending' }]);
    const call = await testPool().query(`SELECT payload FROM dev_provider_calls WHERE operation = 'createCharge'`);
    expect(call.rows[0]!.payload).toMatchObject({ split: { walletId: `wal_${t.teacherId}`, fixedCents: 11495 }, escrow: true });
  });

  it('pedir de novo o mesmo método devolve a mesma cobrança; trocar de método cancela a anterior', async () => {
    const t = await listedTeacher();
    const f = await family();
    const r = await holdSlots(deps(), await request(t, {}, f), NOW);
    if (!r.ok) throw new Error('esperava reserva');
    const a = await startPayment(deps(), { orderId: r.orderId, guardianId: f.guardianId, method: 'pix' }, NOW);
    const b = await startPayment(deps(), { orderId: r.orderId, guardianId: f.guardianId, method: 'pix' }, NOW);
    expect(b.paymentId).toBe(a.paymentId);
    await startPayment(deps(), { orderId: r.orderId, guardianId: f.guardianId, method: 'card' }, NOW);
    const { rows } = await testPool().query(`SELECT method, status FROM payments WHERE order_id = $1 ORDER BY created_at`, [
      r.orderId,
    ]);
    expect(rows).toEqual([
      { method: 'pix', status: 'expired' },
      { method: 'card', status: 'pending' },
    ]);
    const cancels = await testPool().query(`SELECT count(*)::int AS n FROM dev_provider_calls WHERE operation = 'cancelCharge'`);
    expect(cancels.rows[0]!.n).toBe(1);
  });

  it('recusa pedido de outro responsável e reserva vencida', async () => {
    const t = await listedTeacher();
    const f = await family();
    const r = await holdSlots(deps(), await request(t, {}, f), NOW);
    if (!r.ok) throw new Error('esperava reserva');
    const stranger = await family();
    await expect(
      startPayment(deps(), { orderId: r.orderId, guardianId: stranger.guardianId, method: 'pix' }, NOW),
    ).rejects.toThrow(/pedido não encontrado/);
    await expect(
      startPayment(deps(), { orderId: r.orderId, guardianId: f.guardianId, method: 'pix' }, NOW.add({ minutes: 11 })),
    ).rejects.toThrow(/reserva expirou/);
  });
});
