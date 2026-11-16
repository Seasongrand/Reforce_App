/**
 * Fábricas de dados para os testes de banco. Tudo em SQL direto, sem passar
 * pela aplicação, para que os testes do apêndice exercitem só o esquema.
 */
import { randomUUID } from 'node:crypto';

export interface Queryable {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[]; rowCount: number | null }>;
}

let seq = 0;
const next = () => ++seq;

export async function insertTeacher(
  db: Queryable,
  over: Partial<{
    slug: string;
    display_name: string;
    timezone: string;
    min_notice_min: number;
    horizon_days: number;
    slot_step_min: number;
    max_lessons_per_day: number | null;
  }> = {},
): Promise<string> {
  const n = next();
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO teachers (slug, display_name, timezone, min_notice_min, horizon_days, slot_step_min, max_lessons_per_day)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      over.slug ?? `prof-${n}-${randomUUID().slice(0, 8)}`,
      over.display_name ?? `Professor ${n}`,
      over.timezone ?? 'America/Sao_Paulo',
      over.min_notice_min ?? 120,
      over.horizon_days ?? 60,
      over.slot_step_min ?? 30,
      over.max_lessons_per_day ?? null,
    ],
  );
  return rows[0]!.id;
}

export async function insertService(
  db: Queryable,
  teacherId: string,
  over: Partial<{
    subject: string;
    duration_min: number;
    price_cents: number;
    modality: 'online' | 'at_teacher' | 'at_student';
    buffer_before_min: number;
    buffer_after_min: number;
  }> = {},
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO services (teacher_id, subject, duration_min, price_cents, modality, buffer_before_min, buffer_after_min)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      teacherId,
      over.subject ?? 'matematica',
      over.duration_min ?? 60,
      over.price_cents ?? 12100,
      over.modality ?? 'online',
      over.buffer_before_min ?? 0,
      over.buffer_after_min ?? 0,
    ],
  );
  return rows[0]!.id;
}

export async function insertGuardian(db: Queryable, over: Partial<{ name: string; phone_e164: string }> = {}) {
  const n = next();
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO guardians (name, phone_e164) VALUES ($1, $2) RETURNING id`,
    [over.name ?? `Responsável ${n}`, over.phone_e164 ?? `+55119${String(Date.now() % 1e8).padStart(8, '0')}${n}`],
  );
  return rows[0]!.id;
}

export async function insertStudent(db: Queryable, guardianId: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO students (guardian_id, first_name, grade) VALUES ($1, 'Aluno', '9ano') RETURNING id`,
    [guardianId],
  );
  return rows[0]!.id;
}

export interface FamilyOrder {
  guardianId: string;
  studentId: string;
  orderId: string;
}

/** Responsável + aluno + pedido aguardando pagamento, para um serviço. */
export async function insertFamilyOrder(
  db: Queryable,
  teacherId: string,
  serviceId: string,
  over: Partial<{ guardianId: string; lessons: number; total_cents: number; commission_bps: number }> = {},
): Promise<FamilyOrder> {
  const guardianId = over.guardianId ?? (await insertGuardian(db));
  const studentId = await insertStudent(db, guardianId);
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO orders (teacher_id, guardian_id, student_id, service_id, lessons, total_cents, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [teacherId, guardianId, studentId, serviceId, over.lessons ?? 1, over.total_cents ?? 12100, randomUUID()],
  );
  return { guardianId, studentId, orderId: rows[0]!.id };
}

/**
 * Grava uma aula. O intervalo bloqueado é calculado como na aplicação:
 * [início - intervalo antes, início + duração + intervalo depois).
 * `startsAt` é um literal timestamptz, por exemplo '2026-11-17 14:00-03'.
 */
export async function insertBooking(
  db: Queryable,
  b: {
    orderId: string;
    teacherId: string;
    studentId: string;
    serviceId: string;
    startsAt: string;
    durationMin?: number;
    bufferBeforeMin?: number;
    bufferAfterMin?: number;
    status?: string;
    holdExpiresAt?: string | null;
    modality?: 'online' | 'at_teacher' | 'at_student';
    addressId?: string | null;
  },
): Promise<string> {
  const status = b.status ?? 'confirmed';
  const holdExpiresAt = b.holdExpiresAt !== undefined ? b.holdExpiresAt : status === 'held' ? '2999-01-01Z' : null;
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO bookings (order_id, teacher_id, student_id, service_id, starts_at, ends_at, blocked,
                           local_start, timezone, status, hold_expires_at, modality, address_id)
     SELECT $1, t.id, $3, $4, s, s + make_interval(mins => $6::int),
            tstzrange(s - make_interval(mins => $7::int), s + make_interval(mins => $6::int + $8::int), '[)'),
            s AT TIME ZONE t.timezone, t.timezone, $9::booking_status, $10::timestamptz, $11, $12
       FROM teachers t, LATERAL (SELECT $5::timestamptz AS s) x
      WHERE t.id = $2
     RETURNING id`,
    [
      b.orderId,
      b.teacherId,
      b.studentId,
      b.serviceId,
      b.startsAt,
      b.durationMin ?? 60,
      b.bufferBeforeMin ?? 0,
      b.bufferAfterMin ?? 0,
      status,
      holdExpiresAt,
      b.modality ?? 'online',
      b.addressId ?? null,
    ],
  );
  if (!rows[0]) throw new Error('insertBooking: professor não encontrado');
  return rows[0].id;
}

/** Captura o código de erro do PostgreSQL de uma promessa que deve falhar. */
export async function pgErrorCode(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (err) {
    return (err as { code?: string }).code;
  }
  return undefined;
}

export async function pgErrorMessage(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (err) {
    return (err as Error).message;
  }
  return undefined;
}
