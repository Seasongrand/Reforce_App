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
import { SUBJECTS } from './catalog';
import { DomainError } from './errors';
import { normalizePhoneBR } from './guardians/identify';

export const STAGES = { fund2: 'Fundamental 2 (6º ao 9º ano)', medio: 'Ensino médio', pre_vestibular: 'Pré-vestibular' } as const;
export const MODALITIES = { online: 'Online', presencial: 'Presencial' } as const;
export const EDUCATION = {
  licenciatura: 'Licenciatura',
  graduacao: 'Graduação (bacharelado ou tecnólogo)',
  pos_graduacao: 'Pós-graduação',
  cursando: 'Cursando a graduação',
  outro: 'Outra',
} as const;

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
}

export interface WaitlistDeps {
  db: Db;
  config: Pick<AppConfig, 'waitlistExportPassword'>;
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
  const subjects = uniq(input.subjectIds).filter((id) => SUBJECTS.some((s) => s.id === id));
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

  const { rows } = await sql<{ created: boolean }>`
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
    RETURNING (xmax = 0) AS created`.execute(deps.db);
  return { created: rows[0]!.created };
}

/** Célula de CSV: neutraliza fórmula de planilha e escapa aspas, vírgulas e quebras de linha. */
function cell(value: string): string {
  let v = value;
  if (/^[=+\-@\t\r]/.test(v) && !/^\+\d{8,15}$/.test(v)) v = `'${v}`;
  return /[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}

export async function waitlistCsv(deps: Pick<WaitlistDeps, 'db'>): Promise<string> {
  const { rows } = await sql<{
    name: string; email: string; phone_e164: string | null; city: string; state: string; subject_ids: number[];
    stages: Stage[]; modalities: WaitlistModality[]; education: Education; notes: string | null; created_at: string;
  }>`SELECT name, email, phone_e164, city, state, subject_ids, stages, modalities, education, notes, created_at
       FROM teacher_waitlist ORDER BY created_at`.execute(deps.db);
  const header = 'nome,email,whatsapp,cidade,uf,disciplinas,etapas,modalidades,formacao,observacoes,inscrito_em';
  const lines = rows.map((r) =>
    [
      r.name, r.email, r.phone_e164 ?? '', r.city, r.state,
      r.subject_ids.map((id) => SUBJECTS.find((s) => s.id === id)?.name ?? String(id)).join('; '),
      r.stages.map((s) => STAGES[s]).join('; '),
      r.modalities.map((m) => MODALITIES[m]).join('; '),
      EDUCATION[r.education], r.notes ?? '', instantFromDb(r.created_at).toString(),
    ].map(cell).join(','),
  );
  return [header, ...lines].join('\r\n') + '\r\n';
}

const digest = (s: string) => createHash('sha256').update(s).digest();

/** Planilha da lista de espera, protegida por senha (HTTP Basic; o usuário é ignorado). */
export async function serveWaitlistExport(deps: WaitlistDeps, authorization: string | null): Promise<Response> {
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
  return new Response('﻿' + (await waitlistCsv(deps)), {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="lista-de-espera-professores.csv"',
      'cache-control': 'no-store, private',
    },
  });
}
