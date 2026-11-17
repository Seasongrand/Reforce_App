/**
 * Foto do professor (projeto "aluno: do perfil ao pagamento"). O envio é
 * endireitado pela orientação do EXIF, recortado em quadrado de 512 px,
 * convertido para WEBP e guardado sem nenhum metadado (GPS, aparelho, data).
 * Só aparece no perfil depois que a equipe confere com o documento de
 * identidade; aprovar o perfil exige uma foto aprovada.
 */
import sharp from 'sharp';
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { Deps } from '../deps';
import { DomainError } from '../errors';
import type { UploadedFile } from './verification';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const SIZE = 512;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function processPhoto(bytes: Uint8Array, contentType: string): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  if (!ALLOWED.has(contentType)) throw new DomainError('invalid', 'formatos aceitos: JPG, PNG ou WEBP');
  if (bytes.length > MAX_PHOTO_BYTES) throw new DomainError('invalid', 'a foto pode ter até 5 MB');
  try {
    const out = await sharp(bytes, { limitInputPixels: MAX_PIXELS })
      .rotate() // aplica a orientação do EXIF antes de descartá-lo
      .resize(SIZE, SIZE, { fit: 'cover', position: 'attention' })
      .webp({ quality: 82 }) // sem withMetadata: nenhum metadado sai
      .toBuffer({ resolveWithObject: true });
    return { bytes: new Uint8Array(out.data), width: out.info.width, height: out.info.height };
  } catch (err) {
    if (err instanceof Error && /pixel limit/i.test(err.message)) {
      throw new DomainError('invalid', 'a foto é grande demais; envie uma de até 40 megapixels');
    }
    throw new DomainError('invalid', 'não conseguimos abrir esta imagem; envie outra foto em JPG, PNG ou WEBP');
  }
}

export async function submitTeacherPhoto(
  deps: Deps,
  teacherId: string,
  file: UploadedFile,
  _now: Temporal.Instant,
): Promise<{ photoId: string }> {
  if (file.bytes.length === 0) throw new DomainError('invalid', 'escolha uma foto');
  const img = await processPhoto(file.bytes, file.contentType);
  return deps.db.transaction().execute(async (trx) => {
    await sql`UPDATE teacher_photos SET status = 'replaced' WHERE teacher_id = ${teacherId} AND status = 'pending'`.execute(trx);
    const row = await trx.insertInto('teacher_photos')
      .values({ teacher_id: teacherId, image: Buffer.from(img.bytes), width: img.width, height: img.height, status: 'pending' })
      .returning('id').executeTakeFirstOrThrow();
    return { photoId: row.id };
  });
}

export async function decideTeacherPhoto(
  deps: Deps,
  input: { photoId: string; staffId: string; approve: boolean; note?: string },
  now: Temporal.Instant,
): Promise<void> {
  const note = input.note?.trim() || null;
  if (!input.approve && !note) throw new DomainError('invalid', 'informe o motivo da recusa');
  const teacherId = await deps.db.transaction().execute(async (trx) => {
    const photo = await trx.selectFrom('teacher_photos').select(['id', 'teacher_id', 'status'])
      .where('id', '=', input.photoId).forUpdate().executeTakeFirst();
    if (!photo) throw new DomainError('not_found', 'foto não encontrada');
    if (photo.status !== 'pending') throw new DomainError('conflict', 'esta foto já foi analisada');
    if (input.approve) {
      await sql`UPDATE teacher_photos SET status = 'replaced'
                 WHERE teacher_id = ${photo.teacher_id} AND status = 'approved'`.execute(trx);
    }
    await sql`UPDATE teacher_photos
                 SET status = ${input.approve ? 'approved' : 'rejected'}, decided_at = ${now.toString()}::timestamptz,
                     decided_by = ${input.staffId}, decision_note = ${note}
               WHERE id = ${photo.id}`.execute(trx);
    return photo.teacher_id;
  });
  if (!input.approve) {
    const t = await deps.db.selectFrom('teachers').select(['email', 'display_name']).where('id', '=', teacherId).executeTakeFirst();
    if (t?.email) {
      await deps.providers.email.send({
        to: t.email,
        subject: 'Sua foto precisa ser trocada',
        text: `Olá, ${t.display_name}.\n\nA equipe não aprovou a sua foto. Motivo: ${note}\n\n` +
          'Envie outra no seu painel, em "Sua foto": uma foto do rosto, de frente e com boa luz.',
      });
    }
  }
}

const dataUrl = (image: Uint8Array) => `data:image/webp;base64,${Buffer.from(image).toString('base64')}`;

export interface TeacherPhotoState {
  approvedId: string | null;
  approvedDataUrl: string | null;
  pending: { id: string; dataUrl: string } | null;
  /** Motivo da recusa mais recente, se a última foto enviada foi recusada. */
  rejectedNote: string | null;
}

export async function teacherPhotoState(deps: Deps, teacherId: string): Promise<TeacherPhotoState> {
  const rows = await deps.db.selectFrom('teacher_photos').select(['id', 'status', 'image', 'decision_note'])
    .where('teacher_id', '=', teacherId).where('status', 'in', ['approved', 'pending', 'rejected'])
    .orderBy('created_at', 'desc').orderBy('id', 'desc').execute();
  const approved = rows.find((r) => r.status === 'approved');
  const pending = rows.find((r) => r.status === 'pending');
  const latest = rows[0];
  return {
    approvedId: approved?.id ?? null,
    approvedDataUrl: approved ? dataUrl(approved.image) : null,
    pending: pending ? { id: pending.id, dataUrl: dataUrl(pending.image) } : null,
    rejectedNote: latest?.status === 'rejected' ? latest.decision_note : null,
  };
}

/** Bytes da foto para a rota pública: só fotos aprovadas. */
export async function publicPhotoBytes(deps: Pick<Deps, 'db'>, photoId: string): Promise<Uint8Array | null> {
  if (!UUID.test(photoId)) return null;
  const row = await deps.db.selectFrom('teacher_photos').select('image')
    .where('id', '=', photoId).where('status', '=', 'approved').executeTakeFirst();
  return row ? new Uint8Array(row.image) : null;
}

/** Id da foto aprovada (para montar o endereço público), ou null. */
export async function approvedPhotoId(deps: Pick<Deps, 'db'>, teacherId: string): Promise<string | null> {
  const row = await deps.db.selectFrom('teacher_photos').select('id')
    .where('teacher_id', '=', teacherId).where('status', '=', 'approved').executeTakeFirst();
  return row?.id ?? null;
}
