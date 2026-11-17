/**
 * Foto do professor: recortada em quadrado, reduzida, sem metadados (GPS,
 * aparelho, data) e analisada pela equipe antes de aparecer no perfil.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  decideTeacherPhoto, processPhoto, publicPhotoBytes, submitTeacherPhoto, teacherPhotoState,
} from '@/domain/teachers/photo';
import { closeAppDb } from '../helpers/app';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { insertTeacher, seedTestCatalog } from '../helpers/fixtures';
import { NOW, testDeps } from '../helpers/scenario';

beforeEach(async () => {
  await truncateAll();
  await seedTestCatalog(testPool());
});
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = () => testDeps();
const q = async (text: string, params: unknown[] = []) => (await testPool().query(text, params)).rows;

/** JPEG 400×300 com a faixa de cima vermelha e o resto azul, marcado como "girar 90°" no EXIF. */
async function rotatedJpeg(): Promise<Uint8Array> {
  const top = await sharp({ create: { width: 400, height: 60, channels: 3, background: '#ff0000' } }).png().toBuffer();
  return new Uint8Array(
    await sharp({ create: { width: 400, height: 300, channels: 3, background: '#0000ff' } })
      .composite([{ input: top, top: 0, left: 0 }])
      .jpeg()
      .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: 'segredo', Artist: 'celular' } } })
      .toBuffer(),
  );
}

const jpegFile = async () => ({ name: 'eu.jpg', contentType: 'image/jpeg', bytes: await rotatedJpeg() });

async function staff() {
  return (await q(`INSERT INTO staff_users (email, name) VALUES ('ops@exemplo.com', 'Ops') RETURNING id`))[0]!.id as string;
}

describe('processamento da foto', () => {
  it('sai em WEBP 512×512, endireitada e sem metadados', async () => {
    const out = await processPhoto(await rotatedJpeg(), 'image/jpeg');
    const meta = await sharp(out.bytes).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 512, height: 512 });
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
    expect(out).toMatchObject({ width: 512, height: 512 });
    // girada 90° no sentido horário, a faixa vermelha (que estava em cima) vai para a direita
    const { data, info } = await sharp(out.bytes).raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => {
      const i = (y * info.width + x) * info.channels;
      return [data[i]!, data[i + 1]!, data[i + 2]!];
    };
    expect(px(505, 256)[0]).toBeGreaterThan(200); // vermelho na borda direita
    expect(px(6, 256)[2]).toBeGreaterThan(200); // azul na borda esquerda
  });

  it('recusa formato, tamanho e pixels demais', async () => {
    await expect(processPhoto(new Uint8Array([1, 2, 3]), 'image/gif')).rejects.toThrow('formatos aceitos: JPG, PNG ou WEBP');
    await expect(processPhoto(new Uint8Array(5 * 1024 * 1024 + 1), 'image/jpeg')).rejects.toThrow('a foto pode ter até 5 MB');
    const huge = new Uint8Array(
      await sharp({ create: { width: 12000, height: 12000, channels: 3, background: '#ffffff' } }).png({ compressionLevel: 9 }).toBuffer(),
    );
    expect(huge.length).toBeLessThan(5 * 1024 * 1024);
    await expect(processPhoto(huge, 'image/png')).rejects.toThrow('a foto é grande demais; envie uma de até 40 megapixels');
  });
});

describe('envio e análise', () => {
  it('nova foto substitui a que está em análise; aprovar troca a aprovada', async () => {
    const teacherId = await insertTeacher(testPool());
    const s = await staff();
    const first = await submitTeacherPhoto(deps(), teacherId, await jpegFile(), NOW);
    const second = await submitTeacherPhoto(deps(), teacherId, await jpegFile(), NOW);
    expect(await q(`SELECT id, status FROM teacher_photos ORDER BY created_at, id`)).toEqual(
      expect.arrayContaining([{ id: first.photoId, status: 'replaced' }, { id: second.photoId, status: 'pending' }]),
    );
    await decideTeacherPhoto(deps(), { photoId: second.photoId, staffId: s, approve: true }, NOW);
    const third = await submitTeacherPhoto(deps(), teacherId, await jpegFile(), NOW);
    let state = await teacherPhotoState(deps(), teacherId);
    expect(state.approvedId).toBe(second.photoId);
    expect(state.pending?.id).toBe(third.photoId);
    expect(state.pending?.dataUrl).toMatch(/^data:image\/webp;base64,/);
    await decideTeacherPhoto(deps(), { photoId: third.photoId, staffId: s, approve: true }, NOW);
    state = await teacherPhotoState(deps(), teacherId);
    expect(state.approvedId).toBe(third.photoId);
    expect(state.pending).toBeNull();
    expect(await q(`SELECT status FROM teacher_photos WHERE id = $1`, [second.photoId])).toEqual([{ status: 'replaced' }]);
  });

  it('a rota pública só entrega foto aprovada', async () => {
    const teacherId = await insertTeacher(testPool());
    const s = await staff();
    const p = await submitTeacherPhoto(deps(), teacherId, await jpegFile(), NOW);
    expect(await publicPhotoBytes(deps(), p.photoId)).toBeNull();
    await decideTeacherPhoto(deps(), { photoId: p.photoId, staffId: s, approve: false, note: 'Rosto cortado' }, NOW);
    expect(await publicPhotoBytes(deps(), p.photoId)).toBeNull();
    expect(await publicPhotoBytes(deps(), 'nao-e-uuid')).toBeNull();
    const ok = await submitTeacherPhoto(deps(), teacherId, await jpegFile(), NOW);
    await decideTeacherPhoto(deps(), { photoId: ok.photoId, staffId: s, approve: true }, NOW);
    const bytes = await publicPhotoBytes(deps(), ok.photoId);
    expect((await sharp(bytes!).metadata()).format).toBe('webp');
  });

  it('recusa guarda o motivo e avisa o professor por e-mail', async () => {
    const teacherId = await insertTeacher(testPool());
    await testPool().query(`UPDATE teachers SET email = 'ana@exemplo.com' WHERE id = $1`, [teacherId]);
    const s = await staff();
    const p = await submitTeacherPhoto(deps(), teacherId, await jpegFile(), NOW);
    await expect(decideTeacherPhoto(deps(), { photoId: p.photoId, staffId: s, approve: false }, NOW)).rejects.toThrow(/motivo/);
    await decideTeacherPhoto(deps(), { photoId: p.photoId, staffId: s, approve: false, note: 'Rosto cortado' }, NOW);
    expect((await teacherPhotoState(deps(), teacherId)).rejectedNote).toBe('Rosto cortado');
    const mail = await q(`SELECT body FROM dev_outbox WHERE recipient = 'ana@exemplo.com' ORDER BY id DESC LIMIT 1`);
    expect(mail[0]!.body).toContain('Rosto cortado');
  });
});
