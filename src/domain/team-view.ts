/**
 * Página da equipe (/equipe): as listas de espera de professores e de alunos,
 * com o resumo por cidade e disciplina (onde abrir primeiro) e as listas com
 * filtros. O resumo conta todas as inscrições; os filtros valem só para as
 * listas.
 */
import { sql } from 'kysely';
import type { Db } from '@/db/client';
import { instantFromDb } from '@/time/zoned';
import { EDUCATION, MODALITIES, STAGES, WAITLIST_SUBJECTS, type Education, type Stage, type WaitlistModality } from './waitlist';

export interface TeamFilters {
  /** Busca em nome, e-mail e cidade, sem diferença de acento e maiúscula. */
  q?: string;
  uf?: string;
  subjectId?: number;
}

export interface TeamTeacher {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  whatsappUrl: string | null;
  city: string;
  state: string;
  subjects: string[];
  stages: string[];
  modalities: string[];
  education: string;
  notes: string | null;
  createdAt: string;
  /** Link do currículo (com a senha da equipe), ou null se não enviou. */
  cvUrl: string | null;
}

export interface TeamStudent {
  email: string;
  city: string;
  state: string;
  subjects: string[];
  stages: string[];
  createdAt: string;
}

export interface TeamOverview {
  totals: { teachers: number; students: number; withCv: number };
  byCity: { city: string; state: string; teachers: number; students: number }[];
  bySubject: { subject: string; teachers: number; students: number }[];
  /** UFs que aparecem nas inscrições, para o filtro. */
  states: string[];
  teachers: TeamTeacher[];
  students: TeamStudent[];
}

/** "São Paulo " → "sao paulo": compara sem acento, maiúscula e espaços nas pontas. */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const subjectName = (id: number) => WAITLIST_SUBJECTS.find((s) => s.id === id)?.name ?? String(id);

export async function teamOverview(deps: { db: Db }, filters: TeamFilters): Promise<TeamOverview> {
  const teacherRows = (await sql<{
    id: string; name: string; email: string; phone_e164: string | null; city: string; state: string; subject_ids: number[];
    stages: Stage[]; modalities: WaitlistModality[]; education: Education; notes: string | null; created_at: string; has_cv: boolean;
  }>`SELECT w.id, w.name, w.email, w.phone_e164, w.city, w.state, w.subject_ids, w.stages, w.modalities, w.education,
            w.notes, w.created_at, (c.waitlist_id IS NOT NULL) AS has_cv
       FROM teacher_waitlist w LEFT JOIN teacher_waitlist_cvs c ON c.waitlist_id = w.id
      ORDER BY w.created_at DESC, w.email`.execute(deps.db)).rows;
  const studentRows = (await sql<{
    email: string; city: string; state: string; subject_ids: number[]; stages: Stage[]; created_at: string;
  }>`SELECT email, city, state, subject_ids, stages, created_at FROM student_waitlist ORDER BY created_at DESC, email`
    .execute(deps.db)).rows;

  // Por cidade: agrupa grafias diferentes da mesma cidade; mostra a da inscrição mais antiga.
  const cities = new Map<string, { city: string; state: string; teachers: number; students: number; since: number }>();
  const cityOf = (r: { city: string; state: string; created_at: string }) => {
    const key = `${fold(r.city)}|${r.state}`;
    const at = instantFromDb(r.created_at).epochMilliseconds;
    let c = cities.get(key);
    if (!c) cities.set(key, (c = { city: r.city.trim(), state: r.state, teachers: 0, students: 0, since: at }));
    else if (at < c.since) Object.assign(c, { city: r.city.trim(), since: at });
    return c;
  };
  for (const r of teacherRows) cityOf(r).teachers++;
  for (const r of studentRows) cityOf(r).students++;

  const subjects = new Map<number, { teachers: number; students: number }>();
  const subjectOf = (id: number) => {
    let s = subjects.get(id);
    if (!s) subjects.set(id, (s = { teachers: 0, students: 0 }));
    return s;
  };
  for (const r of teacherRows) for (const id of r.subject_ids) subjectOf(id).teachers++;
  for (const r of studentRows) for (const id of r.subject_ids) subjectOf(id).students++;

  const byTotal = <T extends { teachers: number; students: number }>(a: T, b: T, name: (x: T) => string) =>
    b.teachers + b.students - (a.teachers + a.students) || b.teachers - a.teachers || name(a).localeCompare(name(b), 'pt-BR');

  const q = fold(filters.q ?? '');
  const uf = (filters.uf ?? '').trim().toUpperCase();
  const keep = (r: { city: string; state: string; subject_ids: number[] }, text: string[]) =>
    (!q || text.some((t) => fold(t).includes(q))) &&
    (!uf || r.state === uf) &&
    (!filters.subjectId || r.subject_ids.includes(filters.subjectId));

  return {
    totals: { teachers: teacherRows.length, students: studentRows.length, withCv: teacherRows.filter((r) => r.has_cv).length },
    byCity: [...cities.values()].sort((a, b) => byTotal(a, b, (x) => x.city)).map(({ since: _, ...c }) => c),
    bySubject: [...subjects.entries()]
      .map(([id, n]) => ({ subject: subjectName(id), ...n }))
      .sort((a, b) => byTotal(a, b, (x) => x.subject)),
    states: [...new Set([...teacherRows, ...studentRows].map((r) => r.state))].sort(),
    teachers: teacherRows.filter((r) => keep(r, [r.name, r.email, r.city])).map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone_e164,
      whatsappUrl: r.phone_e164 ? `https://wa.me/${r.phone_e164.replace(/\D/g, '')}` : null,
      city: r.city,
      state: r.state,
      subjects: r.subject_ids.map(subjectName),
      stages: r.stages.map((s) => STAGES[s]),
      modalities: r.modalities.map((m) => MODALITIES[m]),
      education: EDUCATION[r.education],
      notes: r.notes,
      createdAt: instantFromDb(r.created_at).toString(),
      cvUrl: r.has_cv ? `/api/lista-de-espera/curriculo/${r.id}` : null,
    })),
    students: studentRows.filter((r) => keep(r, [r.email, r.city])).map((r) => ({
      email: r.email,
      city: r.city,
      state: r.state,
      subjects: r.subject_ids.map(subjectName),
      stages: r.stages.map((s) => STAGES[s]),
      createdAt: instantFromDb(r.created_at).toString(),
    })),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Apaga uma inscrição das listas de espera: a de um professor (o currículo vai
 * junto, por ON DELETE CASCADE) ou a de um aluno (pelo e-mail, que é único).
 * Serve para limpar inscrições de teste e para os pedidos de exclusão da
 * política de privacidade. Diz se apagou alguma coisa.
 */
export async function deleteWaitlistEntry(
  deps: { db: Db },
  entry: { kind: 'teacher'; id: string } | { kind: 'student'; email: string },
): Promise<boolean> {
  if (entry.kind === 'teacher') {
    if (!UUID.test(entry.id)) return false;
    const r = await deps.db.deleteFrom('teacher_waitlist').where('id', '=', entry.id).executeTakeFirst();
    return Number(r.numDeletedRows) > 0;
  }
  const r = await deps.db.deleteFrom('student_waitlist').where('email', '=', entry.email.trim().toLowerCase()).executeTakeFirst();
  return Number(r.numDeletedRows) > 0;
}
