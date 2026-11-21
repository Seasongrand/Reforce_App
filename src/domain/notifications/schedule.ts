/**
 * Agenda as mensagens de uma aula na mesma transação que a confirma (§2.4):
 * se a confirmação não gravar, nada é enviado. O envio é feito pela varredura
 * sendDueNotifications. WhatsApp só com aceite (§3.5); e-mail sempre, como cópia.
 */
import { sql, type Transaction } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { DB } from '@/db/types';
import { instantFromDb } from '@/time/zoned';
import { TEMPLATES, type Channel, type Template } from './catalog';

interface Contacts {
  starts_at: string;
  g_email: string | null;
  g_phone: string | null;
  g_opt: string | null;
  t_email: string | null;
  t_phone: string | null;
  t_opt: string | null;
}

async function contacts(trx: Transaction<DB>, bookingId: string): Promise<Contacts> {
  const { rows } = await sql<Contacts>`
    SELECT b.starts_at, g.email AS g_email, g.phone_e164 AS g_phone, g.whatsapp_opt_in_at AS g_opt,
           t.email AS t_email, t.phone_e164 AS t_phone, t.whatsapp_opt_in_at AS t_opt
      FROM bookings b
      JOIN orders o ON o.id = b.order_id
      JOIN guardians g ON g.id = o.guardian_id
      JOIN teachers t ON t.id = b.teacher_id
     WHERE b.id = ${bookingId}`.execute(trx);
  if (!rows[0]) throw new Error(`aula ${bookingId} não encontrada`);
  return rows[0];
}

function channelsFor(c: Contacts, template: Template): Channel[] {
  const out: Channel[] = [];
  if (TEMPLATES[template] === 'guardian') {
    if (c.g_opt && c.g_phone) out.push('whatsapp');
    if (c.g_email) out.push('email');
  } else {
    if (c.t_opt && c.t_phone) out.push('whatsapp');
    if (c.t_email) out.push('email');
  }
  return out;
}

async function insert(trx: Transaction<DB>, bookingId: string, template: Template, channels: Channel[], sendAt: Temporal.Instant) {
  for (const channel of channels) {
    await sql`INSERT INTO notifications (booking_id, channel, template, send_at)
              VALUES (${bookingId}, ${channel}, ${template}, ${sendAt.toString()}::timestamptz)
              ON CONFLICT (booking_id, channel, template) DO NOTHING`.execute(trx);
  }
}

export async function scheduleForConfirmedBooking(trx: Transaction<DB>, bookingId: string, now: Temporal.Instant) {
  const c = await contacts(trx, bookingId);
  const starts = instantFromDb(c.starts_at);
  const plan: Array<[Template, Temporal.Instant]> = [
    ['confirmacao_responsavel', now],
    ['lembrete_24h_responsavel', starts.subtract({ hours: 24 })],
    ['lembrete_1h_responsavel', starts.subtract({ hours: 1 })],
    ['confirmacao_professor', now],
  ];
  for (const [template, sendAt] of plan) {
    // lembrete cujo horário já passou não é criado
    if (template.startsWith('lembrete') && sendAt.epochMilliseconds <= now.epochMilliseconds) continue;
    await insert(trx, bookingId, template, channelsFor(c, template), sendAt);
  }
}

/** Aula remarcada (a nova): avisa os dois agora e agenda os lembretes da nova data. */
export async function scheduleForRescheduledBooking(trx: Transaction<DB>, bookingId: string, now: Temporal.Instant) {
  const c = await contacts(trx, bookingId);
  const starts = instantFromDb(c.starts_at);
  const plan: Array<[Template, Temporal.Instant]> = [
    ['remarcada_responsavel', now],
    ['remarcada_professor', now],
    ['lembrete_24h_responsavel', starts.subtract({ hours: 24 })],
    ['lembrete_1h_responsavel', starts.subtract({ hours: 1 })],
  ];
  for (const [template, sendAt] of plan) {
    if (template.startsWith('lembrete') && sendAt.epochMilliseconds <= now.epochMilliseconds) continue;
    await insert(trx, bookingId, template, channelsFor(c, template), sendAt);
  }
}

/** Aviso avulso ligado a uma aula (devolução, falta do professor), enviado agora. */
export async function scheduleNotice(trx: Transaction<DB>, bookingId: string, template: Template, now: Temporal.Instant) {
  const c = await contacts(trx, bookingId);
  await insert(trx, bookingId, template, channelsFor(c, template), now);
}
