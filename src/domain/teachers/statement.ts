/**
 * Extrato do professor: as aulas de um mês (pela data da aula, no fuso do
 * professor), com o valor da aula, a comissão da Reforce e o que fica com o
 * professor, e a planilha em CSV. Só lê a tabela de repasses, sem refazer
 * contas. Repasse devolvido ao aluno aparece na lista, mas fica fora das somas.
 */
import { sql } from 'kysely';
import { Temporal } from 'temporal-polyfill';
import type { Db } from '@/db/client';
import { instantFromDb } from '@/time/zoned';
import { subjectName } from '../catalog';
import { DomainError } from '../errors';
import type { PayoutStatus } from './earnings';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export interface StatementItem {
  bookingId: string;
  startsAt: Temporal.Instant;
  studentFirstName: string;
  subject: string;
  grossCents: number;
  platformCents: number;
  teacherCents: number;
  status: PayoutStatus;
}

export interface TeacherStatement {
  month: string;
  label: string;
  timezone: string;
  totals: { lessons: number; grossCents: number; platformCents: number; teacherCents: number; releasedCents: number };
  items: StatementItem[];
}

export const monthLabel = (month: string) => {
  const m = Temporal.PlainYearMonth.from(month);
  return `${MONTHS[m.month - 1]} de ${m.year}`;
};

function parseMonth(month: string): Temporal.PlainYearMonth {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new DomainError('invalid', 'mês inválido');
  return Temporal.PlainYearMonth.from(month);
}

export async function teacherStatement(db: Db, teacherId: string, month: string): Promise<TeacherStatement> {
  const m = parseMonth(month);
  const first = m.toPlainDate({ day: 1 });
  const next = first.add({ months: 1 });
  const t = await db.selectFrom('teachers').select('timezone').where('id', '=', teacherId).executeTakeFirstOrThrow();
  const { rows } = await sql<{
    booking_id: string; starts_at: string; first_name: string; subject: string; gross_cents: number;
    platform_cents: number; teacher_cents: number; status: PayoutStatus;
  }>`
    SELECT po.booking_id, b.starts_at, st.first_name, sv.subject, po.gross_cents, po.platform_cents, po.teacher_cents, po.status
      FROM payouts po
      JOIN bookings b ON b.id = po.booking_id
      JOIN services sv ON sv.id = b.service_id
      JOIN students st ON st.id = b.student_id
     WHERE po.teacher_id = ${teacherId}
       AND b.starts_at >= (${first.toString()}::date)::timestamp AT TIME ZONE ${t.timezone}
       AND b.starts_at <  (${next.toString()}::date)::timestamp AT TIME ZONE ${t.timezone}
     ORDER BY b.starts_at`.execute(db);
  const items: StatementItem[] = rows.map((r) => ({
    bookingId: r.booking_id,
    startsAt: instantFromDb(r.starts_at),
    studentFirstName: r.first_name,
    subject: subjectName(r.subject),
    grossCents: r.gross_cents,
    platformCents: r.platform_cents,
    teacherCents: r.teacher_cents,
    status: r.status,
  }));
  const kept = items.filter((i) => i.status !== 'refunded');
  const sum = (k: 'grossCents' | 'platformCents' | 'teacherCents', list = kept) => list.reduce((a, i) => a + i[k], 0);
  return {
    month: m.toString(),
    label: monthLabel(m.toString()),
    timezone: t.timezone,
    totals: {
      lessons: kept.length,
      grossCents: sum('grossCents'),
      platformCents: sum('platformCents'),
      teacherCents: sum('teacherCents'),
      releasedCents: sum('teacherCents', kept.filter((i) => i.status === 'released')),
    },
    items,
  };
}

/** Meses com aula com repasse, do mais recente ao mais antigo. */
export async function statementMonths(db: Db, teacherId: string): Promise<Array<{ month: string; label: string }>> {
  const { rows } = await sql<{ month: string }>`
    SELECT DISTINCT to_char(b.starts_at AT TIME ZONE t.timezone, 'YYYY-MM') AS month
      FROM payouts po JOIN bookings b ON b.id = po.booking_id JOIN teachers t ON t.id = po.teacher_id
     WHERE po.teacher_id = ${teacherId}
     ORDER BY month DESC`.execute(db);
  return rows.map((r) => ({ month: r.month, label: monthLabel(r.month) }));
}

export const STATUS_LABEL: Record<PayoutStatus, string> = {
  held: 'A receber', releasing: 'A receber', released: 'Liberado', refunded: 'Devolvido ao aluno',
};

const reais = (cents: number) => `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`;
const pad = (n: number) => String(n).padStart(2, '0');
const cell = (s: string) => (/[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Planilha do extrato: ponto e vírgula e vírgula decimal, como o Excel em português abre. */
export function statementCsv(s: TeacherStatement): string {
  const lines = ['Data;Horário;Aluno;Disciplina;Valor da aula;Comissão;Você recebe;Situação'];
  for (const i of s.items) {
    const z = i.startsAt.toZonedDateTimeISO(s.timezone);
    lines.push([
      `${pad(z.day)}/${pad(z.month)}/${z.year}`, `${pad(z.hour)}:${pad(z.minute)}`, cell(i.studentFirstName), cell(i.subject),
      reais(i.grossCents), reais(i.platformCents), reais(i.teacherCents), STATUS_LABEL[i.status],
    ].join(';'));
  }
  return `${lines.join('\r\n')}\r\n`;
}
