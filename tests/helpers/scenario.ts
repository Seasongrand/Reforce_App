/**
 * Cenário pronto para os testes de domínio: professora listada (aprovada, três
 * verificações em dia, conta de recebimento ativa), serviço, regra de terça
 * 14h–18h e famílias com aluno.
 */
import sharp from 'sharp';
import { Temporal } from 'temporal-polyfill';
import type { Deps } from '@/domain/deps';
import { providers } from '@/providers';
import { appDb, testConfig } from './app';
import { testPool } from './db';
import { insertGuardian, insertRule, insertService, insertStudent, insertTeacher } from './fixtures';

/** Segunda 16/11/2026, 08:00 em São Paulo. */
export const NOW = Temporal.Instant.from('2026-11-16T11:00:00Z');
/** Terça 17/11/2026, 14:00 em São Paulo. */
export const TUE_14 = Temporal.Instant.from('2026-11-17T17:00:00Z');
export const at = (s: string) => Temporal.Instant.from(s);

export function testDeps(env: Record<string, string> = {}): Deps {
  const config = testConfig(env);
  return { db: appDb(), config, providers: providers(appDb(), config) };
}

export interface ServiceOpts {
  modality?: 'online' | 'at_teacher' | 'at_student';
  price_cents?: number;
  duration_min?: number;
  buffer_before_min?: number;
  buffer_after_min?: number;
}

let cachedWebp: Buffer | null = null;
/** Foto de teste: WEBP 512×512 lilás. */
async function tinyWebp(): Promise<Buffer> {
  cachedWebp ??= await sharp({ create: { width: 512, height: 512, channels: 3, background: '#e4e0ff' } }).webp().toBuffer();
  return cachedWebp;
}

export async function listedTeacher(
  o: {
    service?: ServiceOpts;
    criminalRecordExpired?: boolean;
    maxLessonsPerDay?: number | null;
    minNoticeMin?: number;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    email?: string;
    withPaymentAccount?: boolean;
  } = {},
) {
  const db = testPool();
  const teacherId = await insertTeacher(db, {
    max_lessons_per_day: o.maxLessonsPerDay ?? null,
    min_notice_min: o.minNoticeMin ?? 120,
  });
  await db.query(
    `UPDATE teachers SET status = 'approved', email = $2, base_lat = $3, base_lng = $4, travel_radius_km = $5
      WHERE id = $1`,
    [teacherId, o.email ?? `prof-${teacherId.slice(0, 8)}@exemplo.com`, o.lat ?? null, o.lng ?? null, o.radiusKm ?? null],
  );
  await db.query(
    `INSERT INTO teacher_verifications (teacher_id, kind, status, decided_at, valid_until) VALUES
       ($1, 'identity', 'approved', now(), NULL), ($1, 'education', 'approved', now(), NULL),
       ($1, 'criminal_record', 'approved', now(), CASE WHEN $2 THEN current_date - 1 ELSE current_date + 180 END)`,
    [teacherId, o.criminalRecordExpired ?? false],
  );
  if (o.withPaymentAccount ?? true) {
    await db.query(
      `INSERT INTO teacher_payment_accounts (teacher_id, provider, provider_account_id, wallet_id, status)
       VALUES ($1::uuid, 'fake', 'acc_' || $1::text, 'wal_' || $1::text, 'active')`,
      [teacherId],
    );
  }
  await db.query(
    `INSERT INTO teacher_photos (teacher_id, image, width, height, status) VALUES ($1, $2, 512, 512, 'approved')`,
    [teacherId, await tinyWebp()],
  );
  const serviceId = await insertService(db, teacherId, o.service ?? {});
  await insertRule(db, teacherId, 2, '14:00', '18:00');
  return { teacherId, serviceId };
}

export async function family(o: { lat?: number; lng?: number; withAddress?: boolean } = {}) {
  const db = testPool();
  const guardianId = await insertGuardian(db);
  await db.query(`UPDATE guardians SET email = $2, timezone = 'America/Sao_Paulo' WHERE id = $1`, [
    guardianId,
    `familia-${guardianId.slice(0, 8)}@exemplo.com`,
  ]);
  const studentId = await insertStudent(db, guardianId);
  let addressId: string | undefined;
  if (o.withAddress) {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO addresses (guardian_id, cep, street, number, city, state, lat, lng)
       VALUES ($1, '01310-100', 'Av. Paulista', '1000', 'São Paulo', 'SP', $2, $3) RETURNING id`,
      [guardianId, o.lat ?? null, o.lng ?? null],
    );
    addressId = rows[0]!.id;
  }
  return { guardianId, studentId, addressId };
}

export const activeBookings = async (teacherId: string) =>
  (await testPool().query(
    `SELECT count(*)::int AS n FROM bookings WHERE teacher_id = $1 AND status IN ('held','confirmed')`,
    [teacherId],
  )).rows[0]!.n as number;

/** Reserva, cobra e paga (webhook falso) uma aula: devolve os ids. */
export async function paidLesson(
  o: {
    service?: ServiceOpts;
    withAddress?: boolean;
    guardianTz?: string;
    guardianOptIn?: boolean;
    teacherOptIn?: boolean;
    startsAt?: Temporal.Instant;
    now?: Temporal.Instant;
    teacherAddress?: string;
  } = {},
) {
  const { holdSlots } = await import('@/domain/booking/hold');
  const { startPayment } = await import('@/domain/payment/charge');
  const { handlePaymentWebhook } = await import('@/domain/payment/webhook');
  const { FakePaymentProvider } = await import('@/providers/payment/fake');
  const now = o.now ?? NOW;
  const t = await listedTeacher({ service: o.service });
  await testPool().query(
    `UPDATE teachers SET display_name = 'Ana Souza', phone_e164 = '+5511977776666',
            whatsapp_opt_in_at = CASE WHEN $2 THEN now() END, teaching_address = $3 WHERE id = $1`,
    [t.teacherId, o.teacherOptIn ?? true, o.teacherAddress ?? 'Rua das Flores, 100, Pinheiros'],
  );
  const f = await family({ withAddress: o.withAddress });
  await testPool().query(
    `UPDATE guardians SET name = 'Maria Lima', phone_e164 = $2, timezone = $3,
            whatsapp_opt_in_at = CASE WHEN $4 THEN now() END WHERE id = $1`,
    [f.guardianId, `+55119${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`, o.guardianTz ?? 'America/Sao_Paulo', o.guardianOptIn ?? true],
  );
  await testPool().query(`UPDATE students SET first_name = 'Joana', grade = '9ano' WHERE id = $1`, [f.studentId]);
  const deps = testDeps();
  const r = await holdSlots(deps, {
    teacherId: t.teacherId, serviceId: t.serviceId, guardianId: f.guardianId, studentId: f.studentId,
    addressId: f.addressId, startsAt: [o.startsAt ?? TUE_14], idempotencyKey: crypto.randomUUID(),
  }, now);
  if (!r.ok) throw new Error(`esperava reserva, veio ${r.reason}`);
  const p = await startPayment(deps, { orderId: r.orderId, guardianId: f.guardianId, method: 'pix' }, now);
  const charge = (await testPool().query(`SELECT provider_charge_id FROM payments WHERE id = $1`, [p.paymentId])).rows[0]!
    .provider_charge_id as string;
  const { headers, body } = (deps.providers.payment as InstanceType<typeof FakePaymentProvider>).simulateEvent(
    charge, 'payment.paid',
  );
  await handlePaymentWebhook(deps, headers, body, now.add({ minutes: 1 }));
  return { ...t, ...f, orderId: r.orderId, bookingId: r.bookingIds[0]!, paymentId: p.paymentId, chargeId: charge };
}
