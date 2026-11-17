/**
 * Lista de avisos para alunos: enquanto a plataforma não abre, o botão
 * "Entrar" leva a uma página onde o adulto responsável (ou o aluno maior de
 * idade) deixa o e-mail para ser avisado da abertura. Uma inscrição por
 * e-mail. A planilha mostra a procura por cidade, disciplina e etapa, e usa a
 * mesma senha da planilha dos professores.
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { Db } from '@/db/client';
import { instantFromDb } from '@/time/zoned';
import { normalizeEmail } from './auth/codes';
import { DomainError } from './errors';
import { csvCell, refuseWithoutPassword, STAGES, WAITLIST_SUBJECTS, type Stage, type WaitlistDeps } from './waitlist';

export interface StudentWaitlistInput {
  email: string;
  city: string;
  state: string;
  subjectIds: number[];
  stages: Stage[];
  /** "Tenho 18 anos ou mais e autorizo o aviso por e-mail": menores não se inscrevem. */
  adultConsent: boolean;
  /** Campo-armadilha: pessoas não veem; robôs preenchem. */
  website?: string | null;
}

const uniq = <T>(xs: T[]) => [...new Set(xs)];

export async function joinStudentWaitlist(
  deps: { db: Db },
  input: StudentWaitlistInput,
  now: Temporal.Instant,
): Promise<{ created: boolean }> {
  if (input.website?.trim()) return { created: true }; // robô: finge sucesso, não grava
  const email = normalizeEmail(input.email);
  const city = input.city.trim();
  if (city.length < 2 || city.length > 80) throw new DomainError('invalid', 'informe sua cidade');
  const state = input.state.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) throw new DomainError('invalid', 'UF inválida');
  const subjects = uniq(input.subjectIds);
  if (subjects.length === 0 || !subjects.every((id) => WAITLIST_SUBJECTS.some((s) => s.id === id))) {
    throw new DomainError('invalid', 'escolha ao menos uma disciplina da lista');
  }
  const stages = uniq(input.stages);
  if (stages.length === 0 || !stages.every((s) => s in STAGES)) throw new DomainError('invalid', 'escolha ao menos uma etapa');
  if (!input.adultConsent) {
    throw new DomainError('invalid', 'confirme que você tem 18 anos ou mais e autoriza o aviso por e-mail');
  }
  const at = now.toString();
  const { rows } = await sql<{ created: boolean }>`
    INSERT INTO student_waitlist (email, city, state, subject_ids, stages, consent_at, created_at, updated_at)
    VALUES (${email}, ${city}, ${state}, ${subjects}::smallint[], ${stages}::text[],
            ${at}::timestamptz, ${at}::timestamptz, ${at}::timestamptz)
    ON CONFLICT (email) DO UPDATE
       SET city = EXCLUDED.city, state = EXCLUDED.state, subject_ids = EXCLUDED.subject_ids, stages = EXCLUDED.stages,
           consent_at = EXCLUDED.consent_at, updated_at = EXCLUDED.updated_at
    RETURNING (xmax = 0) AS created`.execute(deps.db);
  return { created: rows[0]!.created };
}

export async function studentWaitlistCsv(deps: { db: Db }): Promise<string> {
  const { rows } = await sql<{
    email: string; city: string; state: string; subject_ids: number[]; stages: Stage[]; created_at: string; updated_at: string;
  }>`SELECT email, city, state, subject_ids, stages, created_at, updated_at FROM student_waitlist ORDER BY created_at, email`
    .execute(deps.db);
  const header = 'email,cidade,uf,disciplinas,etapas,inscrito_em,atualizado_em';
  const lines = rows.map((r) =>
    [
      r.email, r.city, r.state,
      r.subject_ids.map((id) => WAITLIST_SUBJECTS.find((s) => s.id === id)?.name ?? String(id)).join('; '),
      r.stages.map((s) => STAGES[s]).join('; '),
      instantFromDb(r.created_at).toString(), instantFromDb(r.updated_at).toString(),
    ].map(csvCell).join(','),
  );
  return [header, ...lines].join('\r\n') + '\r\n';
}

/** Planilha dos alunos que pediram aviso, com a senha da planilha dos professores. */
export async function serveStudentWaitlistExport(deps: WaitlistDeps, authorization: string | null): Promise<Response> {
  const refused = refuseWithoutPassword(deps, authorization);
  if (refused) return refused;
  return new Response('﻿' + (await studentWaitlistCsv(deps)), {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="lista-de-espera-alunos.csv"',
      'cache-control': 'no-store, private',
    },
  });
}
