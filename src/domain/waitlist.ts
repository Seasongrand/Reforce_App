/**
 * Lista de espera de professores (§4: a oferta vem antes da abertura; meta de
 * 30 a 50 professores verificados). Inscrição pública, uma por e-mail, e
 * exportação em planilha protegida por senha.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { AppConfig } from '@/config';
import type { Db } from '@/db/client';
import { instantFromDb } from '@/time/zoned';
import { normalizeEmail } from './auth/codes';
import { DomainError } from './errors';
import { normalizePhoneBR } from './guardians/identify';

export const STAGES = { fund2: 'Fundamental 2 (6º ao 9º ano)', medio: 'Ensino médio', pre_vestibular: 'Pré-vestibular' } as const;
export const MODALITIES = { online: 'Online', presencial: 'Presencial' } as const;
export const EDUCATION = {
  licenciatura: 'Licenciatura',
  graduacao: 'Graduação (bacharelado ou tecnólogo)',
  pos_graduacao: 'Pós-graduação (especialização)',
  mestrado: 'Mestrado',
  doutorado: 'Doutorado',
  cursando: 'Cursando a graduação',
  outro: 'Outra',
} as const;

/**
 * Disciplinas da lista de espera: todas as do 6º ano ao pré-vestibular, para
 * conhecer a oferta. Os ids 1 a 4 são os do catálogo do marketplace
 * (src/domain/catalog.ts), que na abertura começa com quatro disciplinas;
 * os demais ficam reservados para quando o catálogo crescer.
 */
export const WAITLIST_SUBJECTS = [
  { id: 1, name: 'Matemática' },
  { id: 5, name: 'Língua Portuguesa' },
  { id: 4, name: 'Redação' },
  { id: 6, name: 'Literatura' },
  { id: 2, name: 'Física' },
  { id: 3, name: 'Química' },
  { id: 7, name: 'Biologia' },
  { id: 8, name: 'Ciências' },
  { id: 9, name: 'História' },
  { id: 10, name: 'Geografia' },
  { id: 11, name: 'Filosofia' },
  { id: 12, name: 'Sociologia' },
  { id: 13, name: 'Inglês' },
  { id: 14, name: 'Espanhol' },
  { id: 15, name: 'Arte' },
  { id: 16, name: 'Educação Física' },
] as const;

/** Currículo: os formatos de documento mais usados, conferidos pelo conteúdo do arquivo. */
export const MAX_CV_BYTES = 5 * 1024 * 1024;
const CV_FORMATS: Array<{ ext: string; type: string; magic: number[] }> = [
  { ext: 'pdf', type: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  { ext: 'docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', magic: [0x50, 0x4b, 0x03, 0x04] },
  { ext: 'odt', type: 'application/vnd.oasis.opendocument.text', magic: [0x50, 0x4b, 0x03, 0x04] },
  { ext: 'doc', type: 'application/msword', magic: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
];
const CV_ERROR = 'envie o currículo em PDF, DOC, DOCX ou ODT';

function checkCv(file: { name: string; bytes: Uint8Array }): { ext: string; type: string } {
  if (file.bytes.length > MAX_CV_BYTES) throw new DomainError('invalid', 'o currículo pode ter até 5 MB');
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  const f = CV_FORMATS.find((x) => x.ext === ext);
  if (!f || !f.magic.every((b, i) => file.bytes[i] === b)) throw new DomainError('invalid', CV_ERROR);
  return { ext: f.ext, type: f.type };
}

export type Stage = keyof typeof STAGES;
export type WaitlistModality = keyof typeof MODALITIES;
export type Education = keyof typeof EDUCATION;

export interface WaitlistInput {
  name: string;
  email: string;
  phone?: string | null;
  city: string;
  state: string;
  subjectIds: number[];
  stages: Stage[];
  modalities: WaitlistModality[];
  education: Education;
  notes?: string | null;
  consent: boolean;
  /** Campo-armadilha: pessoas não veem; robôs preenchem. */
  website?: string | null;
  /** Currículo opcional (PDF, DOC, DOCX ou ODT, até 5 MB). */
  cv?: { name: string; contentType: string; bytes: Uint8Array } | null;
}

export interface WaitlistDeps {
  db: Db;
  config: Pick<AppConfig, 'waitlistExportPassword' | 'appBaseUrl'>;
}

const uniq = <T>(xs: T[]) => [...new Set(xs)];

export async function joinTeacherWaitlist(
  deps: Pick<WaitlistDeps, 'db'>,
  input: WaitlistInput,
  now: Temporal.Instant,
): Promise<{ created: boolean }> {
  if (input.website?.trim()) return { created: true }; // robô: finge sucesso, não grava
  if (!input.consent) throw new DomainError('invalid', 'é preciso autorizar o contato para entrar na lista');
  const name = input.name.trim();
  if (name.length < 3 || name.length > 120) throw new DomainError('invalid', 'informe seu nome completo');
  const email = normalizeEmail(input.email);
  const phone = input.phone?.trim() ? normalizePhoneBR(input.phone) : null;
  const city = input.city.trim();
  if (city.length < 2 || city.length > 80) throw new DomainError('invalid', 'informe sua cidade');
  const state = input.state.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) throw new DomainError('invalid', 'UF inválida');
  const subjects = uniq(input.subjectIds).filter((id) => WAITLIST_SUBJECTS.some((s) => s.id === id));
  if (subjects.length === 0 || subjects.length !== uniq(input.subjectIds).length) {
    throw new DomainError('invalid', 'escolha ao menos uma disciplina da lista');
  }
  const stages = uniq(input.stages);
  if (stages.length === 0 || !stages.every((s) => s in STAGES)) throw new DomainError('invalid', 'escolha ao menos uma etapa');
  const modalities = uniq(input.modalities);
  if (modalities.length === 0 || !modalities.every((m) => m in MODALITIES)) {
    throw new DomainError('invalid', 'escolha ao menos uma modalidade');
  }
  if (!(input.education in EDUCATION)) throw new DomainError('invalid', 'escolha sua formação');
  const notes = input.notes?.trim() || null;
  if (notes && notes.length > 1000) throw new DomainError('invalid', 'a mensagem pode ter até 1.000 caracteres');
  const cv = input.cv && input.cv.bytes.length > 0 ? { ...input.cv, ...checkCv(input.cv) } : null;

  return deps.db.transaction().execute(async (trx) => {
    const { rows } = await sql<{ id: string; created: boolean }>`
      INSERT INTO teacher_waitlist (name, email, phone_e164, city, state, subject_ids, stages, modalities, education,
                                    notes, consent_at, created_at, updated_at)
      VALUES (${name}, ${email}, ${phone}, ${city}, ${state}, ${subjects}::smallint[], ${stages}::text[],
              ${modalities}::text[], ${input.education}, ${notes},
              ${now.toString()}::timestamptz, ${now.toString()}::timestamptz, ${now.toString()}::timestamptz)
      ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name, phone_e164 = EXCLUDED.phone_e164, city = EXCLUDED.city, state = EXCLUDED.state,
             subject_ids = EXCLUDED.subject_ids, stages = EXCLUDED.stages, modalities = EXCLUDED.modalities,
             education = EXCLUDED.education, notes = EXCLUDED.notes, consent_at = EXCLUDED.consent_at,
             updated_at = EXCLUDED.updated_at
      RETURNING id, (xmax = 0) AS created`.execute(trx);
    if (cv) {
      await sql`
        INSERT INTO teacher_waitlist_cvs (waitlist_id, file_name, content_type, bytes, uploaded_at)
        VALUES (${rows[0]!.id}, ${cv.name.slice(0, 120)}, ${cv.type}, ${Buffer.from(cv.bytes)}, ${now.toString()}::timestamptz)
        ON CONFLICT (waitlist_id) DO UPDATE
           SET file_name = EXCLUDED.file_name, content_type = EXCLUDED.content_type, bytes = EXCLUDED.bytes,
               uploaded_at = EXCLUDED.uploaded_at`.execute(trx);
    }
    return { created: rows[0]!.created };
  });
}

/** Célula de CSV: neutraliza fórmula de planilha e escapa aspas, vírgulas e quebras de linha. */
export function csvCell(value: string): string {
  let v = value;
  if (/^[=+\-@\t\r]/.test(v) && !/^\+\d{8,15}$/.test(v)) v = `'${v}`;
  return /[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}

export async function waitlistCsv(deps: Pick<WaitlistDeps, 'db'> & { config: Pick<AppConfig, 'appBaseUrl'> }): Promise<string> {
  const { rows } = await sql<{
    id: string; name: string; email: string; phone_e164: string | null; city: string; state: string; subject_ids: number[];
    stages: Stage[]; modalities: WaitlistModality[]; education: Education; notes: string | null; created_at: string;
    has_cv: boolean;
  }>`SELECT w.id, w.name, w.email, w.phone_e164, w.city, w.state, w.subject_ids, w.stages, w.modalities, w.education,
            w.notes, w.created_at, (c.waitlist_id IS NOT NULL) AS has_cv
       FROM teacher_waitlist w LEFT JOIN teacher_waitlist_cvs c ON c.waitlist_id = w.id
      ORDER BY w.created_at`.execute(deps.db);
  const header = 'nome,email,whatsapp,cidade,uf,disciplinas,etapas,modalidades,formacao,observacoes,inscrito_em,curriculo';
  const lines = rows.map((r) =>
    [
      r.name, r.email, r.phone_e164 ?? '', r.city, r.state,
      r.subject_ids.map((id) => WAITLIST_SUBJECTS.find((s) => s.id === id)?.name ?? String(id)).join('; '),
      r.stages.map((s) => STAGES[s]).join('; '),
      r.modalities.map((m) => MODALITIES[m]).join('; '),
      EDUCATION[r.education], r.notes ?? '', instantFromDb(r.created_at).toString(),
      r.has_cv ? `${deps.config.appBaseUrl}/api/lista-de-espera/curriculo/${r.id}` : '',
    ].map(csvCell).join(','),
  );
  return [header, ...lines].join('\r\n') + '\r\n';
}

const digest = (s: string) => createHash('sha256').update(s).digest();

/**
 * Senha da equipe para as planilhas e os currículos (HTTP Basic; o usuário é
 * ignorado). Devolve a resposta de recusa, ou null se a senha confere.
 */
export function refuseWithoutPassword(deps: Pick<WaitlistDeps, 'config'>, authorization: string | null): Response | null {
  const password = deps.config.waitlistExportPassword;
  if (!password) return new Response('não encontrado', { status: 404 });
  const given = authorization?.startsWith('Basic ')
    ? Buffer.from(authorization.slice(6), 'base64').toString('utf8').split(':').slice(1).join(':')
    : null;
  if (given === null || !timingSafeEqual(digest(given), digest(password))) {
    return new Response('senha necessária', {
      status: 401,
      headers: { 'www-authenticate': 'Basic realm="Lista de espera", charset="UTF-8"', 'cache-control': 'no-store' },
    });
  }
  return null;
}

/** Currículo de uma inscrição, com a mesma senha da planilha. */
export async function serveWaitlistCv(deps: WaitlistDeps, authorization: string | null, waitlistId: string): Promise<Response> {
  const refused = refuseWithoutPassword(deps, authorization);
  if (refused) return refused;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(waitlistId)) {
    return new Response('não encontrado', { status: 404 });
  }
  const row = (await sql<{ name: string; content_type: string; bytes: Buffer; file_name: string }>`
    SELECT w.name, c.content_type, c.bytes, c.file_name FROM teacher_waitlist_cvs c
      JOIN teacher_waitlist w ON w.id = c.waitlist_id WHERE c.waitlist_id = ${waitlistId}`.execute(deps.db)).rows[0];
  if (!row) return new Response('não encontrado', { status: 404 });
  const ext = row.file_name.toLowerCase().split('.').pop();
  const slug = row.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 60) || 'professor';
  return new Response(new Uint8Array(row.bytes), {
    status: 200,
    headers: {
      'content-type': row.content_type,
      'content-disposition': `attachment; filename="curriculo-${slug}.${ext}"`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

/** Planilha da lista de espera, protegida por senha (HTTP Basic; o usuário é ignorado). */
export async function serveWaitlistExport(deps: WaitlistDeps, authorization: string | null): Promise<Response> {
  const refused = refuseWithoutPassword(deps, authorization);
  if (refused) return refused;
  return new Response('﻿' + (await waitlistCsv(deps)), {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="lista-de-espera-professores.csv"',
      'cache-control': 'no-store, private',
    },
  });
}
