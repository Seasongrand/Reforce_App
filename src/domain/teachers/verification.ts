/**
 * Documentos de verificação (§3.7): identidade (documento e selfie),
 * certidão de antecedentes e comprovante de formação. Os arquivos ficam em
 * armazenamento privado e cifrado; no banco, só o prefixo da pasta.
 */
import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { Deps } from '../deps';
import { DomainError } from '../errors';

export type VerificationKind = 'identity' | 'criminal_record' | 'education';
export const VERIFICATION_KINDS: VerificationKind[] = ['identity', 'criminal_record', 'education'];
export const KIND_LABEL: Record<VerificationKind, string> = {
  identity: 'identidade',
  criminal_record: 'antecedentes criminais',
  education: 'formação',
};

const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface UploadedFile {
  name: string;
  contentType: string;
  bytes: Uint8Array;
}

const safeName = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[-.]+/, '')
    .slice(0, 60) || 'arquivo';

export async function submitVerificationDocument(
  deps: Deps,
  teacherId: string,
  input: { kind: VerificationKind; files: UploadedFile[] },
  now: Temporal.Instant,
): Promise<{ verificationId: string }> {
  if (!VERIFICATION_KINDS.includes(input.kind)) throw new DomainError('invalid', 'tipo de verificação inválido');
  const files = input.files.filter((f) => f.bytes.length > 0);
  if (input.kind === 'identity' && files.length !== 2) {
    throw new DomainError('invalid', 'para a identidade, envie documento e selfie (dois arquivos)');
  }
  if (files.length < 1 || files.length > 3) throw new DomainError('invalid', 'envie de 1 a 3 arquivos');
  for (const f of files) {
    if (!ALLOWED_TYPES.has(f.contentType)) throw new DomainError('invalid', 'formatos aceitos: PDF, JPG, PNG ou WEBP');
    if (f.bytes.length > MAX_FILE_BYTES) throw new DomainError('invalid', 'cada arquivo pode ter até 10 MB');
  }

  const live = await deps.db.selectFrom('teacher_verifications').select(['id', 'status', 'valid_until'])
    .where('teacher_id', '=', teacherId).where('kind', '=', input.kind).where('status', 'in', ['pending', 'approved'])
    .executeTakeFirst();
  const today = now.toZonedDateTimeISO('America/Sao_Paulo').toPlainDate().toString();
  if (live?.status === 'pending') throw new DomainError('conflict', 'este documento já foi enviado e está em análise');
  if (live?.status === 'approved') {
    if (!live.valid_until || live.valid_until >= today) throw new DomainError('conflict', 'este documento já está aprovado');
    await sql`UPDATE teacher_verifications SET status = 'expired' WHERE id = ${live.id}`.execute(deps.db);
  }

  const id = randomUUID();
  const prefix = `verificacoes/${teacherId}/${id}`;
  const keys = files.map((f, i) => `${prefix}/${i + 1}-${safeName(f.name)}`);
  for (const [i, f] of files.entries()) await deps.providers.storage.put(keys[i]!, f.bytes, f.contentType);
  try {
    await sql`INSERT INTO teacher_verifications (id, teacher_id, kind, status, evidence_key, submitted_at)
              VALUES (${id}, ${teacherId}, ${input.kind}, 'pending', ${`${prefix}/`}, ${now.toString()}::timestamptz)`
      .execute(deps.db);
  } catch (err) {
    for (const k of keys) await deps.providers.storage.delete(k);
    throw err;
  }
  return { verificationId: id };
}

export interface VerificationView {
  id: string;
  kind: VerificationKind;
  status: string;
  decisionNote: string | null;
  validUntil: string | null;
  submittedAt: string;
  files: string[];
}

export async function listVerifications(deps: Deps, teacherId: string): Promise<VerificationView[]> {
  const rows = await deps.db.selectFrom('teacher_verifications')
    .select(['id', 'kind', 'status', 'decision_note', 'valid_until', 'submitted_at', 'evidence_key'])
    .where('teacher_id', '=', teacherId).orderBy('submitted_at', 'desc').execute();
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      kind: r.kind as VerificationKind,
      status: r.status,
      decisionNote: r.decision_note,
      validUntil: r.valid_until,
      submittedAt: r.submitted_at,
      files: r.evidence_key ? await deps.providers.storage.list(r.evidence_key) : [],
    })),
  );
}
