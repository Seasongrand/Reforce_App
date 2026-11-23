/**
 * Painel "Início" do professor: os sete passos até vender aulas (com o que
 * falta em cada um), as próximas aulas e o link da página pública, que só
 * existe depois da aprovação.
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { Deps } from '../deps';
import { teacherLessons, type TeacherLesson } from './lessons';
import { teacherPhotoState } from './photo';
import { DEFAULT_SLUG_PREFIX } from './profile';
import { missingForReview } from './review';

export type DashboardStepKey = 'foto' | 'perfil' | 'documentos' | 'recebimento' | 'analise' | 'servicos' | 'agenda';
export interface DashboardStep {
  key: DashboardStepKey;
  label: string;
  done: boolean;
  /** O que já foi feito, ou o que falta. */
  detail: string;
  href: string;
}

export interface TeacherDashboard {
  firstName: string;
  /** Fuso da agenda do professor, para mostrar os horários das aulas. */
  timezone: string;
  status: string;
  steps: DashboardStep[];
  done: number;
  total: number;
  /** Cadastro em preenchimento e completo: pode ir para a análise da equipe. */
  canSubmit: boolean;
  /** Endereço da página pública, só depois da aprovação. */
  pageUrl: string | null;
  /** Até 3 aulas confirmadas que ainda não terminaram, da mais próxima à mais distante. */
  upcoming: TeacherLesson[];
}

const REVIEW_DETAIL: Record<string, string> = {
  draft: 'Envie quando os passos acima estiverem prontos',
  in_review: 'Em análise pela equipe',
  approved: 'Aprovado',
  paused: 'Pausado',
  suspended: 'Suspenso',
};

export async function teacherDashboard(deps: Deps, teacherId: string, now: Temporal.Instant): Promise<TeacherDashboard> {
  const t = await deps.db.selectFrom('teachers').select(['display_name', 'status', 'slug', 'timezone']).where('id', '=', teacherId)
    .executeTakeFirstOrThrow();
  const missing = await missingForReview(deps, teacherId, now);
  const photo = await teacherPhotoState(deps, teacherId);
  const counts = (await sql<{ subjects: number; services: number; rules: number }>`
    SELECT (SELECT count(*) FROM teacher_subjects WHERE teacher_id = ${teacherId})::int AS subjects,
           (SELECT count(*) FROM services WHERE teacher_id = ${teacherId} AND active)::int AS services,
           (SELECT count(*) FROM availability_rules WHERE teacher_id = ${teacherId})::int AS rules`.execute(deps.db)).rows[0]!;

  const profileDone = !t.slug.startsWith(DEFAULT_SLUG_PREFIX) && counts.subjects > 0;
  const docsMissing = missing.filter((m) => m.startsWith('documento de'));
  const photoDetail = photo.approvedId ? 'Aprovada' : photo.pending ? 'Em análise'
    : photo.rejectedNote ? `Recusada: ${photo.rejectedNote}. Envie outra` : 'Uma foto do rosto, de frente e com boa luz';

  const steps: DashboardStep[] = [
    { key: 'foto', label: 'Sua foto', done: Boolean(photo.approvedId || photo.pending), detail: photoDetail, href: '/professor/cadastro' },
    {
      key: 'perfil', label: 'Seu perfil', done: profileDone, href: '/professor/cadastro',
      detail: profileDone ? 'Nome, endereço da página e disciplinas' : 'Falta: nome, endereço da página e disciplinas',
    },
    {
      key: 'documentos', label: 'Documentos de verificação', done: docsMissing.length === 0, href: '/professor/verificacao',
      detail: docsMissing.length === 0 ? 'Documentos enviados' : `Falta: ${docsMissing.join(', ')}`,
    },
    {
      key: 'recebimento', label: 'Conta de recebimento', done: !missing.includes('conta de recebimento'), href: '/professor/recebimento',
      detail: missing.includes('conta de recebimento') ? 'Para receber o valor das aulas' : 'Conta aberta',
    },
    { key: 'analise', label: 'Análise da equipe', done: t.status === 'approved', detail: REVIEW_DETAIL[t.status] ?? t.status, href: '/professor' },
    {
      key: 'servicos', label: 'Serviços e preços', done: counts.services > 0, href: '/professor/servicos',
      detail: counts.services > 0 ? `${counts.services} ${counts.services === 1 ? 'serviço ativo' : 'serviços ativos'}` : 'Defina disciplina, duração e preço',
    },
    {
      key: 'agenda', label: 'Agenda', done: counts.rules > 0, href: '/professor/agenda',
      detail: counts.rules > 0 ? 'Horários da semana definidos' : 'Seus horários livres na semana',
    },
  ];

  const upcoming = (await teacherLessons(deps.db, teacherId, now))
    .filter((l) => l.status === 'confirmed' && l.endsAt.epochMilliseconds > now.epochMilliseconds)
    .slice(0, 3);

  return {
    firstName: t.display_name.trim().split(/\s+/)[0] ?? t.display_name,
    timezone: t.timezone,
    status: t.status,
    steps,
    done: steps.filter((s) => s.done).length,
    total: steps.length,
    canSubmit: t.status === 'draft' && missing.length === 0,
    pageUrl: t.status === 'approved' ? `${deps.config.appBaseUrl}/p/${t.slug}` : null,
    upcoming,
  };
}
