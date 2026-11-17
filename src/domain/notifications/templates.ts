/**
 * Textos das mensagens. Estritamente transacionais (§3.5: tom promocional
 * reclassifica o modelo como marketing). Horário no fuso de quem lê, com o
 * do professor quando difere. A família nunca recebe telefone ou e-mail do
 * professor, e o professor nunca recebe os da família (§3.7).
 */
import { sql, type Kysely } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { DB } from '@/db/types';
import { formatBRL } from '@/lib/money';
import { bothTimes, formatPtBr, instantFromDb } from '@/time/zoned';
import { gradeName, subjectName } from '../catalog';
import type { Deps } from '../deps';
import { checkinCode } from '../lessons/checkin';
import { lessonToken } from '../lessons/links';
import type { Template } from './catalog';

export interface MessageContext {
  bookingId: string;
  orderId: string;
  modality: 'online' | 'at_teacher' | 'at_student';
  startsAt: Temporal.Instant;
  durationMin: number;
  totalCents: number;
  subject: string;
  guardian: { name: string; phone: string; email: string | null; timezone: string };
  student: { firstName: string; grade: string };
  teacher: { name: string; slug: string; timezone: string; phone: string | null; email: string | null; teachingAddress: string | null };
  familyAddress: string | null;
  checkinCode: string | null;
  links: { lesson: string; teacherPage: string; teacherPanel: string };
}

export interface RenderedMessage {
  whatsapp: { name: string; vars: Record<string, string>; preview: string };
  email: { subject: string; text: string };
}

export async function loadMessageContext(deps: Deps, bookingId: string, db: Kysely<DB> = deps.db): Promise<MessageContext> {
  const { rows } = await sql<{
    order_id: string; modality: string; starts_at: string; ends_at: string; total_cents: number; lessons: number;
    subject_slug: string; subject_name: string | null; duration_min: number;
    g_name: string; g_phone: string; g_email: string | null; g_tz: string | null;
    s_name: string; s_grade: string | null;
    t_name: string; t_slug: string; t_tz: string; t_phone: string | null; t_email: string | null; t_address: string | null;
    a_street: string | null; a_number: string | null; a_district: string | null; a_city: string | null; a_state: string | null;
  }>`
    SELECT b.order_id, b.modality, b.starts_at, b.ends_at, o.total_cents, o.lessons,
           sv.subject AS subject_slug, sj.name AS subject_name, sv.duration_min,
           g.name AS g_name, g.phone_e164 AS g_phone, g.email AS g_email, g.timezone AS g_tz,
           st.first_name AS s_name, st.grade AS s_grade,
           t.display_name AS t_name, t.slug AS t_slug, t.timezone AS t_tz, t.phone_e164 AS t_phone,
           t.email AS t_email, t.teaching_address AS t_address,
           a.street AS a_street, a.number AS a_number, a.district AS a_district, a.city AS a_city, a.state AS a_state
      FROM bookings b
      JOIN orders o ON o.id = b.order_id
      JOIN services sv ON sv.id = b.service_id
      LEFT JOIN subjects sj ON sj.id = sv.subject_id
      JOIN guardians g ON g.id = o.guardian_id
      JOIN students st ON st.id = b.student_id
      JOIN teachers t ON t.id = b.teacher_id
      LEFT JOIN addresses a ON a.id = b.address_id
     WHERE b.id = ${bookingId}`.execute(db);
  const r = rows[0];
  if (!r) throw new Error(`aula ${bookingId} não encontrada`);
  const base = deps.config.appBaseUrl;
  const secret = deps.config.sessionSecret;
  const endsAt = instantFromDb(r.ends_at);
  const modality = r.modality as MessageContext['modality'];
  return {
    bookingId,
    orderId: r.order_id,
    modality,
    startsAt: instantFromDb(r.starts_at),
    durationMin: r.duration_min,
    totalCents: Math.round(r.total_cents / r.lessons),
    subject: (r.subject_name ?? subjectName(r.subject_slug)).toLowerCase(),
    guardian: { name: r.g_name, phone: r.g_phone, email: r.g_email, timezone: r.g_tz ?? r.t_tz },
    student: { firstName: r.s_name, grade: gradeName(r.s_grade) },
    teacher: {
      name: r.t_name, slug: r.t_slug, timezone: r.t_tz, phone: r.t_phone, email: r.t_email, teachingAddress: r.t_address,
    },
    familyAddress: r.a_street
      ? `${r.a_street}${r.a_number ? `, ${r.a_number}` : ''}${r.a_district ? `, ${r.a_district}` : ''}, ${r.a_city}/${r.a_state}`
      : null,
    checkinCode: modality === 'online' ? null : checkinCode(bookingId, secret),
    links: {
      lesson: `${base}/aula/${lessonToken(bookingId, 'student', endsAt.add({ hours: 24 }), secret)}`,
      teacherPage: `${base}/p/${r.t_slug}`,
      teacherPanel: `${base}/professor/aulas`,
    },
  };
}

function familyModalityBlock(c: MessageContext): string {
  switch (c.modality) {
    case 'online':
      return `A aula é online, na sala da plataforma. Ela abre 10 minutos antes, neste link: ${c.links.lesson}`;
    case 'at_teacher':
      return `A aula é no endereço do professor: ${c.teacher.teachingAddress ?? '(confira no link abaixo)'}.\n` +
        `Na chegada, informe ao professor este código: ${c.checkinCode}.`;
    case 'at_student':
      return `A aula é no seu endereço: ${c.familyAddress}.\n` +
        `Quando o professor chegar, informe este código: ${c.checkinCode}. ` +
        'Pela regra da plataforma, um adulto deve estar em casa na primeira aula.';
  }
}

function teacherModalityBlock(c: MessageContext): string {
  switch (c.modality) {
    case 'online':
      return 'A aula é online, na sala da plataforma. O link está no seu painel.';
    case 'at_teacher':
      return 'A aula é no seu endereço. Na chegada, o aluno vai informar o código da aula: digite-o no painel.';
    case 'at_student':
      return `A aula é na casa do aluno: ${c.familyAddress}.\nNa chegada, peça o código da aula e digite-o no painel.`;
  }
}

export function render(template: Template, c: MessageContext): RenderedMessage {
  const when = bothTimes(c.startsAt, c.teacher.timezone, c.guardian.timezone);
  const vars = {
    nome: c.guardian.name, aluno: c.student.firstName, professor: c.teacher.name, disciplina: c.subject, horario: when,
    link: c.links.lesson,
  };
  let subject: string;
  let text: string;
  switch (template) {
    case 'confirmacao_responsavel':
      subject = `Aula confirmada: ${c.subject} com ${c.teacher.name}`;
      text = `Olá, ${c.guardian.name}.\n\nA aula de ${c.subject} de ${c.student.firstName} com ${c.teacher.name} ` +
        `está confirmada para ${when}.\n\n${familyModalityBlock(c)}\n\nDetalhes da aula: ${c.links.lesson}`;
      break;
    case 'lembrete_24h_responsavel':
      subject = `Lembrete: aula de ${c.subject} amanhã`;
      text = `Olá, ${c.guardian.name}.\n\nLembrete: amanhã tem aula de ${c.subject} de ${c.student.firstName} ` +
        `com ${c.teacher.name}, ${when}.\n\n${familyModalityBlock(c)}`;
      break;
    case 'lembrete_1h_responsavel':
      subject = `A aula de ${c.subject} começa em 1 hora`;
      text = `Olá, ${c.guardian.name}.\n\nA aula de ${c.subject} de ${c.student.firstName} com ${c.teacher.name} ` +
        `começa em 1 hora: ${when}.\n\n${familyModalityBlock(c)}`;
      break;
    case 'pagamento_tardio_reembolso':
      subject = 'Pagamento devolvido: o horário já tinha sido reservado';
      text = `Olá, ${c.guardian.name}.\n\nRecebemos o pagamento de ${formatBRL(c.totalCents)} depois que a reserva ` +
        `temporária expirou, e o horário de ${when} já tinha sido reservado. Devolvemos o valor integral pelo ` +
        `mesmo meio de pagamento.\n\nPara escolher outro horário com ${c.teacher.name}: ${c.links.teacherPage}`;
      break;
    case 'falta_professor_reembolso':
      subject = 'A aula não aconteceu: valor devolvido';
      text = `Olá, ${c.guardian.name}.\n\n${c.teacher.name} não entrou na aula de ${c.subject} de ${when}. ` +
        `Devolvemos o valor integral de ${formatBRL(c.totalCents)} pelo mesmo meio de pagamento. Pedimos desculpas.`;
      break;
    case 'falta_aluno_devolvida':
      subject = 'Falta justificada: valor da aula devolvido';
      text = `Olá, ${c.guardian.name}.\n\n${c.teacher.name} devolveu o valor da aula de ${c.subject} de ${when}, ` +
        `em que ${c.student.firstName} não pôde participar. A devolução é feita pelo mesmo meio de pagamento.`;
      break;
    case 'confirmacao_professor': {
      const at = formatPtBr(c.startsAt, c.teacher.timezone);
      subject = `Nova aula paga: ${c.student.firstName}, ${at}`;
      text = `Olá, ${c.teacher.name}.\n\nNova aula paga de ${c.subject}: ${c.student.firstName}` +
        `${c.student.grade ? ` (${c.student.grade})` : ''}, ${at}, ${c.durationMin} minutos.\n\n` +
        `${teacherModalityBlock(c)}\n\nVeja no painel: ${c.links.teacherPanel}`;
      return {
        whatsapp: { name: template, vars: { professor: c.teacher.name, aluno: c.student.firstName, horario: at }, preview: text },
        email: { subject, text },
      };
    }
  }
  return { whatsapp: { name: template, vars, preview: text }, email: { subject, text } };
}
