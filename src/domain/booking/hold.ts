/**
 * Reserva temporária (§2.4). Em uma transação, com a trava do professor:
 * limpa as reservas vencidas no caminho, revalida o que a restrição não cobre
 * (professor vendável, antecedência, janela, grade, limite diário, raio) e grava.
 * Se alguém chegou antes, o banco responde 23P01 e a família recebe "ocupado".
 */
import { sql, type Transaction } from 'kysely';
import { Temporal } from 'temporal-polyfill';
import type { DB } from '@/db/types';
import { isSlotTaken } from '@/db/errors';
import { instantFromDb, plainToDb, toLocal } from '@/time/zoned';
import { syncCalendarBusy } from '../calendar/sync';
import type { Deps } from '../deps';
import { DomainError } from '../errors';

export type HoldReason =
  | 'ocupado'
  | 'indisponivel'
  | 'antecedencia'
  | 'limite_diario'
  | 'professor_indisponivel'
  | 'fora_do_raio';

export interface HoldRequest {
  teacherId: string;
  serviceId: string;
  guardianId: string;
  studentId: string;
  addressId?: string | null;
  /** Um horário na Fase 1; N só no pacote semanal (teste do apêndice). */
  startsAt: Temporal.Instant[];
  idempotencyKey: string;
  /** Origem da família no primeiro contato; vale a primeira registrada. */
  acquisition?: 'teacher_link' | 'marketplace';
  /** Horário fixo semanal: a aula da semana fica presa até este instante (24 horas antes dela). */
  holdUntil?: Temporal.Instant;
  seriesId?: string;
}

export type HoldResult =
  | { ok: true; orderId: string; bookingIds: string[]; holdExpiresAt: Temporal.Instant }
  | { ok: false; reason: HoldReason; alternatives: Temporal.Instant[] };

class Rejected extends Error {
  constructor(readonly reason: HoldReason) {
    super(reason);
  }
}

const ts = (i: Temporal.Instant) => i.toString();

export async function holdSlots(deps: Deps, req: HoldRequest, now: Temporal.Instant): Promise<HoldResult> {
  const { db } = deps;
  if (req.startsAt.length === 0) throw new DomainError('invalid', 'nenhum horário escolhido');
  const starts = [...req.startsAt].sort(Temporal.Instant.compare);

  const svc = await db
    .selectFrom('services')
    .innerJoin('teachers', 'teachers.id', 'services.teacher_id')
    .select([
      'services.id', 'services.duration_min', 'services.buffer_before_min', 'services.buffer_after_min',
      'services.price_cents', 'services.modality', 'services.active', 'teachers.timezone',
    ])
    .where('services.id', '=', req.serviceId)
    .where('services.teacher_id', '=', req.teacherId)
    .executeTakeFirst();
  if (!svc || !svc.active) throw new DomainError('not_found', 'serviço não encontrado');

  // fora da transação: livre/ocupado do calendário externo (nunca dentro dela)
  await syncCalendarBusy(
    deps,
    req.teacherId,
    {
      start: starts[0]!.subtract({ minutes: svc.buffer_before_min }),
      end: starts.at(-1)!.add({ minutes: svc.duration_min + svc.buffer_after_min }),
    },
    now,
  );

  try {
    return await db.transaction().execute((trx) => holdInTx(deps, trx, req, starts, svc, now));
  } catch (err) {
    if (err instanceof Rejected) return { ok: false, reason: err.reason, alternatives: await nearestFree(deps, req, starts[0]!, now) };
    if (isSlotTaken(err)) return { ok: false, reason: 'ocupado', alternatives: await nearestFree(deps, req, starts[0]!, now) };
    throw err;
  }
}

interface Svc {
  duration_min: number;
  buffer_before_min: number;
  buffer_after_min: number;
  price_cents: number;
  modality: string;
  timezone: string;
}

async function holdInTx(
  deps: Deps,
  trx: Transaction<DB>,
  req: HoldRequest,
  starts: Temporal.Instant[],
  svc: Svc,
  now: Temporal.Instant,
): Promise<HoldResult> {
  await sql`SELECT pg_advisory_xact_lock(hashtextextended('teacher:' || ${req.teacherId}, 0))`.execute(trx);

  // idempotência: mesmo clique repetido devolve o mesmo pedido
  const existing = await trx
    .selectFrom('orders')
    .select(['id', 'guardian_id'])
    .where('idempotency_key', '=', req.idempotencyKey)
    .executeTakeFirst();
  if (existing) {
    if (existing.guardian_id !== req.guardianId) throw new DomainError('conflict', 'chave de idempotência já usada');
    const rows = await trx.selectFrom('bookings').select(['id', 'hold_expires_at']).where('order_id', '=', existing.id).execute();
    const expiries = rows.map((r) => r.hold_expires_at).filter((x): x is string => x !== null).map(instantFromDb);
    return {
      ok: true,
      orderId: existing.id,
      bookingIds: rows.map((r) => r.id),
      holdExpiresAt: expiries.sort(Temporal.Instant.compare)[0] ?? now,
    };
  }

  const student = await trx.selectFrom('students').select('id').where('id', '=', req.studentId)
    .where('guardian_id', '=', req.guardianId).executeTakeFirst();
  if (!student) throw new DomainError('invalid', 'aluno não encontrado para este responsável');

  let addressId: string | null = null;
  if (svc.modality === 'at_student') {
    if (!req.addressId) throw new DomainError('invalid', 'aula na casa do aluno exige o endereço');
    const addr = await trx.selectFrom('addresses').select('id').where('id', '=', req.addressId)
      .where('guardian_id', '=', req.guardianId).executeTakeFirst();
    if (!addr) throw new DomainError('invalid', 'endereço não encontrado para este responsável');
    addressId = addr.id;
  }

  const sellable = await sql<{ ok: boolean }>`
    SELECT EXISTS (SELECT 1 FROM teachers_listed WHERE id = ${req.teacherId})
       AND EXISTS (SELECT 1 FROM teacher_payment_accounts WHERE teacher_id = ${req.teacherId} AND status = 'active') AS ok`
    .execute(trx);
  if (!sellable.rows[0]!.ok) throw new Rejected('professor_indisponivel');

  if (addressId) {
    const radius = await sql<{ outside: boolean }>`
      SELECT earth_distance(ll_to_earth(t.base_lat, t.base_lng), ll_to_earth(a.lat, a.lng)) > t.travel_radius_km * 1000 AS outside
        FROM teachers t, addresses a
       WHERE t.id = ${req.teacherId} AND a.id = ${addressId}
         AND t.base_lat IS NOT NULL AND t.travel_radius_km IS NOT NULL AND a.lat IS NOT NULL`.execute(trx);
    if (radius.rows[0]?.outside) throw new Rejected('fora_do_raio');
  }

  // origem da família: o primeiro registro prevalece; a comissão sai dela
  await sql`INSERT INTO teacher_guardian_links (teacher_id, guardian_id, acquisition)
            VALUES (${req.teacherId}, ${req.guardianId}, ${req.acquisition ?? 'teacher_link'})
            ON CONFLICT (teacher_id, guardian_id) DO NOTHING`.execute(trx);
  const link = await trx.selectFrom('teacher_guardian_links').select('acquisition')
    .where('teacher_id', '=', req.teacherId).where('guardian_id', '=', req.guardianId).executeTakeFirstOrThrow();
  const commissionBps = deps.config.commissionBps[link.acquisition as 'teacher_link' | 'marketplace'];

  const holdExpiresAt = req.holdUntil ?? now.add({ minutes: deps.config.holdMinutes });
  const order = await trx
    .insertInto('orders')
    .values({
      teacher_id: req.teacherId, guardian_id: req.guardianId, student_id: req.studentId, service_id: req.serviceId,
      lessons: starts.length, total_cents: svc.price_cents * starts.length, status: 'awaiting_payment',
      expires_at: ts(holdExpiresAt), idempotency_key: req.idempotencyKey, commission_bps: commissionBps,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const bookingIds: string[] = [];
  for (const start of starts) {
    const local = plainToDb(toLocal(start, svc.timezone));
    const range = sql`tstzrange((${local}::timestamp AT TIME ZONE ${svc.timezone}) - make_interval(mins => ${svc.buffer_before_min}::int),
                                (${local}::timestamp AT TIME ZONE ${svc.timezone}) + make_interval(mins => ${svc.duration_min + svc.buffer_after_min}::int), '[)')`;

    // 1. reservas temporárias vencidas que estejam no caminho deixam de bloquear
    await sql`WITH gone AS (
                UPDATE bookings SET status = 'expired'
                 WHERE teacher_id = ${req.teacherId} AND status = 'held'
                   AND hold_expires_at < ${ts(now)}::timestamptz AND blocked && ${range}
                RETURNING order_id)
              UPDATE orders SET status = 'expired'
               WHERE id IN (SELECT order_id FROM gone) AND status = 'awaiting_payment'`.execute(trx);

    // 2. revalidar o que a restrição não cobre
    const check = await sql<{ s: string; on_grid: boolean; busy: boolean; same_day: number; max_day: number | null; local_date: string }>`
      WITH t AS (SELECT * FROM teachers WHERE id = ${req.teacherId}),
           x AS (SELECT (${local}::timestamp AT TIME ZONE t.timezone) AS s, ${local}::timestamp::date AS d FROM t)
      SELECT x.s, x.d::text AS local_date, t.max_lessons_per_day AS max_day,
             EXISTS (SELECT 1 FROM free_slots(${req.teacherId}, ${req.serviceId}, x.d, x.d, ${ts(now)}::timestamptz) f
                      WHERE f = x.s) AS on_grid,
             EXISTS (SELECT 1 FROM bookings b
                      WHERE b.teacher_id = t.id AND b.blocked && ${range}
                        AND (b.status = 'confirmed' OR (b.status = 'held' AND b.hold_expires_at > ${ts(now)}::timestamptz))) AS busy,
             (SELECT count(*)::int FROM bookings b
               WHERE b.teacher_id = t.id
                 AND (b.starts_at AT TIME ZONE t.timezone)::date = x.d
                 AND (b.status = 'confirmed' OR (b.status = 'held' AND b.hold_expires_at > ${ts(now)}::timestamptz))) AS same_day
        FROM t, x`.execute(trx);
    const c = check.rows[0]!;
    if (!instantFromDb(c.s).equals(start)) throw new Rejected('indisponivel'); // hora que não existe no fuso
    const t = await trx.selectFrom('teachers').select(['min_notice_min', 'horizon_days']).where('id', '=', req.teacherId)
      .executeTakeFirstOrThrow();
    if (Temporal.Instant.compare(start, now.add({ minutes: t.min_notice_min })) < 0) throw new Rejected('antecedencia');
    if (c.max_day !== null && c.same_day >= c.max_day) throw new Rejected('limite_diario');
    if (!c.on_grid) throw new Rejected(c.busy ? 'ocupado' : 'indisponivel');

    // 3. ocupar o horário; se alguém chegou antes, o banco responde 23P01
    const ins = await sql<{ id: string }>`
      INSERT INTO bookings (order_id, teacher_id, student_id, service_id, starts_at, ends_at, blocked,
                            local_start, timezone, status, hold_expires_at, modality, address_id, series_id)
      SELECT ${order.id}, t.id, ${req.studentId}, ${req.serviceId},
             s, s + make_interval(mins => ${svc.duration_min}::int),
             tstzrange(s - make_interval(mins => ${svc.buffer_before_min}::int),
                       s + make_interval(mins => ${svc.duration_min + svc.buffer_after_min}::int), '[)'),
             ${local}::timestamp, t.timezone, 'held', ${ts(holdExpiresAt)}::timestamptz, ${svc.modality}, ${addressId},
             ${req.seriesId ?? null}::uuid
        FROM teachers t, LATERAL (SELECT ${local}::timestamp AT TIME ZONE t.timezone AS s) x
       WHERE t.id = ${req.teacherId}
      RETURNING id`.execute(trx);
    bookingIds.push(ins.rows[0]!.id);
  }

  return { ok: true, orderId: order.id, bookingIds, holdExpiresAt };
}

/** Até 5 horários livres mais próximos do pedido, do mais perto ao mais longe. */
async function nearestFree(deps: Deps, req: HoldRequest, requested: Temporal.Instant, now: Temporal.Instant) {
  const { rows } = await sql<{ s: string }>`
    WITH t AS (SELECT timezone FROM teachers WHERE id = ${req.teacherId}),
         d AS (SELECT (${ts(requested)}::timestamptz AT TIME ZONE t.timezone)::date AS day FROM t)
    SELECT f AS s FROM d, free_slots(${req.teacherId}, ${req.serviceId}, d.day - 1, d.day + 14, ${ts(now)}::timestamptz) f
     ORDER BY abs(extract(epoch FROM f - ${ts(requested)}::timestamptz)), f
     LIMIT 5`.execute(deps.db);
  return rows.map((r) => instantFromDb(r.s));
}
