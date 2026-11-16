/**
 * Análise da equipe (§1, professor, passo 3; §3.7). Cada documento é aprovado
 * ou recusado com motivo; a certidão ganha validade (padrão: 6 meses). O
 * perfil só vende depois de aprovado com as três verificações em dia.
 */
import { sql } from 'kysely';
import { Temporal } from 'temporal-polyfill';
import { enqueue } from '@/worker/enqueue';
import type { Deps } from '../deps';
import { DomainError } from '../errors';
import { KIND_LABEL, listVerifications, type VerificationKind, type VerificationView } from '../teachers/verification';

const today = (now: Temporal.Instant) => now.toZonedDateTimeISO('America/Sao_Paulo').toPlainDate();

export interface QueueItem {
  teacherId: string;
  name: string;
  email: string | null;
  slug: string;
  status: string;
  verifications: VerificationView[];
  paymentAccount: string | null;
}

/** Professores em análise e quem tem documento aguardando decisão. */
export async function reviewQueue(deps: Deps): Promise<QueueItem[]> {
  const { rows } = await sql<{ id: string; display_name: string; email: string | null; slug: string; status: string; acc: string | null }>`
    SELECT t.id, t.display_name, t.email, t.slug, t.status, a.status AS acc
      FROM teachers t
      LEFT JOIN teacher_payment_accounts a ON a.teacher_id = t.id
     WHERE t.status = 'in_review'
        OR EXISTS (SELECT 1 FROM teacher_verifications v WHERE v.teacher_id = t.id AND v.status = 'pending')
     ORDER BY (SELECT min(submitted_at) FROM teacher_verifications v WHERE v.teacher_id = t.id AND v.status = 'pending')
              NULLS LAST, t.created_at`.execute(deps.db);
  return Promise.all(
    rows.map(async (r) => {
      const all = await listVerifications(deps, r.id);
      const latest = (['identity', 'criminal_record', 'education'] as VerificationKind[])
        .map((k) => all.find((v) => v.kind === k))
        .filter((v): v is VerificationView => v !== undefined);
      return {
        teacherId: r.id, name: r.display_name, email: r.email, slug: r.slug, status: r.status,
        verifications: latest, paymentAccount: r.acc,
      };
    }),
  );
}

async function notifyTeacher(deps: Deps, teacherId: string, subject: string, text: string) {
  const t = await deps.db.selectFrom('teachers').select(['email', 'display_name']).where('id', '=', teacherId).executeTakeFirst();
  if (t?.email) await deps.providers.email.send({ to: t.email, subject, text: `Olá, ${t.display_name}.\n\n${text}` });
}

export async function decideVerification(
  deps: Deps,
  input: { verificationId: string; staffId: string; decision: 'approved' | 'rejected'; note?: string; validUntil?: string },
  now: Temporal.Instant,
): Promise<void> {
  const note = input.note?.trim() || null;
  if (input.decision === 'rejected' && !note) throw new DomainError('invalid', 'informe o motivo da recusa');
  const v = await deps.db.selectFrom('teacher_verifications').select(['teacher_id', 'kind', 'status'])
    .where('id', '=', input.verificationId).executeTakeFirst();
  if (!v || v.status !== 'pending') throw new DomainError('conflict', 'este documento não está aguardando análise');
  const kind = v.kind as VerificationKind;

  let validUntil: string | null = null;
  if (input.decision === 'approved' && kind === 'criminal_record') {
    const d = input.validUntil
      ? Temporal.PlainDate.from(input.validUntil)
      : today(now).add({ months: deps.config.criminalRecordValidityMonths });
    if (Temporal.PlainDate.compare(d, today(now)) <= 0) throw new DomainError('invalid', 'a validade precisa ser futura');
    validUntil = d.toString();
  }
  await deps.db.transaction().execute(async (trx) => {
    await sql`UPDATE teacher_verifications
                 SET status = ${input.decision}, decided_at = ${now.toString()}::timestamptz, decided_by = ${input.staffId},
                     decision_note = ${note}, valid_until = ${validUntil}::date
               WHERE id = ${input.verificationId} AND status = 'pending'`.execute(trx);
    if (input.decision === 'rejected') {
      // o professor precisa reenviar: o cadastro volta para ele
      await sql`UPDATE teachers SET status = 'draft' WHERE id = ${v.teacher_id} AND status = 'in_review'`.execute(trx);
    }
  });
  if (input.decision === 'rejected') {
    await notifyTeacher(deps, v.teacher_id, `Documento de ${KIND_LABEL[kind]} recusado`,
      `O documento de ${KIND_LABEL[kind]} que você enviou foi recusado.\nMotivo: ${note}\n\n` +
      `Envie um novo arquivo no seu painel e mande o cadastro para análise de novo: ${deps.config.appBaseUrl}/professor/verificacao`);
  }
}

export async function approveTeacher(deps: Deps, input: { teacherId: string; staffId: string }, now: Temporal.Instant) {
  const t = await deps.db.selectFrom('teachers').select(['status', 'slug']).where('id', '=', input.teacherId).executeTakeFirst();
  if (!t || t.status !== 'in_review') throw new DomainError('conflict', 'o professor não está em análise');
  const ok = await sql<{ n: number }>`
    SELECT count(DISTINCT kind)::int AS n FROM teacher_verifications
     WHERE teacher_id = ${input.teacherId} AND status = 'approved'
       AND (valid_until IS NULL OR valid_until >= ${today(now).toString()}::date)`.execute(deps.db);
  if (ok.rows[0]!.n !== 3) throw new DomainError('conflict', 'aprove antes as três verificações (identidade, antecedentes e formação)');
  const acc = await deps.db.selectFrom('teacher_payment_accounts').select('status').where('teacher_id', '=', input.teacherId)
    .where('status', '=', 'active').executeTakeFirst();
  if (!acc) throw new DomainError('conflict', 'a conta de recebimento do professor ainda não está ativa');
  await deps.db.transaction().execute(async (trx) => {
    await sql`UPDATE teachers SET status = 'approved' WHERE id = ${input.teacherId} AND status = 'in_review'`.execute(trx);
    await enqueue(trx, 'search.refresh_teacher', { teacherId: input.teacherId }, { jobKey: `refresh:${input.teacherId}` });
  });
  await notifyTeacher(deps, input.teacherId, 'Seu perfil foi aprovado',
    `Seu perfil foi aprovado e já pode receber reservas.\nSua página: ${deps.config.appBaseUrl}/p/${t.slug}\n\n` +
    `Configure seus horários em ${deps.config.appBaseUrl}/professor/agenda.`);
}

export async function setTeacherStatus(
  deps: Deps,
  input: { teacherId: string; staffId: string; status: 'approved' | 'paused' | 'suspended' },
  _now: Temporal.Instant,
): Promise<void> {
  const allowedFrom = input.status === 'approved' ? ['paused', 'suspended'] : ['approved', 'paused', 'in_review'];
  const r = await sql`UPDATE teachers SET status = ${input.status}
                       WHERE id = ${input.teacherId} AND status = ANY(${allowedFrom}::text[])`.execute(deps.db);
  if (Number(r.numAffectedRows ?? 0) === 0) throw new DomainError('conflict', 'mudança de situação não permitida');
  await enqueue(deps.db, 'search.refresh_teacher', { teacherId: input.teacherId }, { jobKey: `refresh:${input.teacherId}` });
}

/** Links temporários (5 minutos) para os arquivos de uma verificação. */
export async function verificationFileLinks(deps: Deps, verificationId: string, now: Temporal.Instant) {
  const v = await deps.db.selectFrom('teacher_verifications').select('evidence_key').where('id', '=', verificationId)
    .executeTakeFirst();
  if (!v?.evidence_key) return [];
  const keys = await deps.providers.storage.list(v.evidence_key);
  return keys.map((key) => ({ name: key.split('/').pop()!, url: deps.providers.storage.signedUrl(key, 300, now) }));
}

/** Varredura diária: certidão vencida passa a 'expired' e o professor sai da venda (§1). */
export async function expireVerifications(deps: Deps, now: Temporal.Instant): Promise<number> {
  const { rows } = await sql<{ teacher_id: string }>`
    UPDATE teacher_verifications SET status = 'expired'
     WHERE status = 'approved' AND valid_until < ${today(now).toString()}::date
    RETURNING teacher_id`.execute(deps.db);
  for (const teacherId of new Set(rows.map((r) => r.teacher_id))) {
    await enqueue(deps.db, 'search.refresh_teacher', { teacherId }, { jobKey: `refresh:${teacherId}` });
  }
  return rows.length;
}
