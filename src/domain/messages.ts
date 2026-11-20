/**
 * Mensagens entre o responsável e o professor (especificação: "O que entra";
 * decisão do dono de 20/11: contatos sempre ocultos). Só os dois conversam: a
 * família pode começar com qualquer professor aprovado, e o professor só
 * responde a conversas que já existem. O aluno não tem acesso. A primeira
 * mensagem cria o vínculo família–professor, o mesmo da reserva.
 */
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { Db } from '@/db/client';
import { instantFromDb } from '@/time/zoned';
import { enqueue } from '@/worker/enqueue';
import type { Deps } from './deps';
import { DomainError } from './errors';

export const MAX_MESSAGE = 2000;
const NOTIFY_EVERY_MIN = 15;
const HIDDEN = '[contato oculto]';

// a ordem importa: endereços completos antes de domínios soltos e de perfis
const CONTACTS: Array<[RegExp, string]> = [
  [/\bhttps?:\/\/\S+/gi, HIDDEN],
  [/\bwww\.\S+/gi, HIDDEN],
  [/\bwa\.me\/\S*/gi, HIDDEN],
  // e-mail, inclusive por extenso ("maria arroba gmail ponto com")
  [/[\w.+-]+\s*(?:@|\(at\)|\barroba\b)\s*[\w-]+(?:\s*(?:\.|\bponto\b)\s*[\w-]+)+/gi, HIDDEN],
  [/\b[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|me|io|app|link|site|br)(?:\.br)?\b(?:\/\S*)?/gi, HIDDEN],
  [/(^|[\s(])@[\w.]{3,}/g, `$1${HIDDEN}`], // perfil de rede social
];
// telefone: 8 a 13 dígitos com espaço, ponto, hífen ou parênteses entre eles (datas, com "/", passam)
const PHONE = /\(?\+?\d[\d\s().-]{6,}\d/g;

export function hideContacts(text: string): { text: string; hidden: boolean } {
  let out = text;
  for (const [re, by] of CONTACTS) out = out.replace(re, by);
  out = out.replace(PHONE, (m) => {
    const digits = m.replace(/\D/g, '').length;
    return digits >= 8 && digits <= 13 ? HIDDEN : m;
  });
  return { text: out, hidden: out !== text };
}

export type Side = 'teacher' | 'guardian';
const other = (s: Side): Side => (s === 'teacher' ? 'guardian' : 'teacher');
const readCol = (s: Side) => sql.ref(`l.${s}_read_at`);

/** "Maria Lima" vira "Maria L.", como nas avaliações. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]!.toUpperCase()}.` : parts[0] ?? '';
}

export async function sendMessage(
  deps: Deps,
  input: { teacherId: string; guardianId: string; from: Side; body: string },
  now: Temporal.Instant,
): Promise<{ hidden: boolean }> {
  const body = input.body.trim();
  if (!body) throw new DomainError('invalid', 'escreva a mensagem');
  if (body.length > MAX_MESSAGE) throw new DomainError('invalid', 'a mensagem passa de 2.000 caracteres');
  const at = now.toString();
  const masked = hideContacts(body);
  await deps.db.transaction().execute(async (trx) => {
    if (input.from === 'guardian') {
      const t = await trx.selectFrom('teachers').select('status').where('id', '=', input.teacherId).executeTakeFirst();
      if (t?.status !== 'approved') throw new DomainError('not_found', 'professor não encontrado');
      // o vínculo nasce como na reserva (src/domain/booking/hold.ts): a origem da família ainda não é registrada
      await sql`INSERT INTO teacher_guardian_links (teacher_id, guardian_id, acquisition)
                VALUES (${input.teacherId}, ${input.guardianId}, 'teacher_link')
                ON CONFLICT (teacher_id, guardian_id) DO NOTHING`.execute(trx);
    } else {
      const link = await trx.selectFrom('teacher_guardian_links').select('teacher_id')
        .where('teacher_id', '=', input.teacherId).where('guardian_id', '=', input.guardianId).executeTakeFirst();
      if (!link) throw new DomainError('not_found', 'conversa não encontrada');
    }
    await sql`INSERT INTO messages (teacher_id, guardian_id, sender, body, masked, created_at)
              VALUES (${input.teacherId}, ${input.guardianId}, ${input.from}, ${masked.text}, ${masked.hidden}, ${at}::timestamptz)`
      .execute(trx);
    // quem escreve já leu a conversa até aqui
    await sql`UPDATE teacher_guardian_links SET ${sql.ref(`${input.from}_read_at`)} = ${at}::timestamptz
               WHERE teacher_id = ${input.teacherId} AND guardian_id = ${input.guardianId}`.execute(trx);
    await enqueue(trx, 'message.notify', { teacherId: input.teacherId, guardianId: input.guardianId, to: other(input.from) },
      { jobKey: `msg:${input.teacherId}:${input.guardianId}:${other(input.from)}` });
  });
  return { hidden: masked.hidden };
}

export interface Conversation {
  teacherId: string;
  guardianId: string;
  /** O outro lado: o nome do professor para a família; "Maria L." para o professor. */
  name: string;
  teacherSlug: string;
  lastBody: string;
  lastAt: Temporal.Instant;
  lastFromMe: boolean;
  unread: number;
}

export async function conversations(db: Db, viewer: { kind: Side; id: string }): Promise<Conversation[]> {
  const them = other(viewer.kind);
  const { rows } = await sql<{
    teacher_id: string; guardian_id: string; t_name: string; t_slug: string; g_name: string;
    last_body: string; last_at: string; last_sender: Side; unread: number;
  }>`
    SELECT l.teacher_id, l.guardian_id, t.display_name AS t_name, t.slug AS t_slug, g.name AS g_name,
           m.body AS last_body, m.created_at AS last_at, m.sender AS last_sender,
           (SELECT count(*) FROM messages x
             WHERE x.teacher_id = l.teacher_id AND x.guardian_id = l.guardian_id AND x.sender = ${them}
               AND x.created_at > coalesce(${readCol(viewer.kind)}, '-infinity'))::int AS unread
      FROM teacher_guardian_links l
      JOIN teachers t ON t.id = l.teacher_id
      JOIN guardians g ON g.id = l.guardian_id
      JOIN LATERAL (SELECT body, created_at, sender FROM messages
                     WHERE teacher_id = l.teacher_id AND guardian_id = l.guardian_id
                     ORDER BY created_at DESC, id DESC LIMIT 1) m ON true
     WHERE ${sql.ref(`l.${viewer.kind}_id`)} = ${viewer.id}
     ORDER BY m.created_at DESC`.execute(db);
  return rows.map((r) => ({
    teacherId: r.teacher_id,
    guardianId: r.guardian_id,
    name: viewer.kind === 'guardian' ? r.t_name : shortName(r.g_name),
    teacherSlug: r.t_slug,
    lastBody: r.last_body,
    lastAt: instantFromDb(r.last_at),
    lastFromMe: r.last_sender === viewer.kind,
    unread: r.unread,
  }));
}

export async function unreadTotal(db: Db, viewer: { kind: Side; id: string }): Promise<number> {
  const { rows } = await sql<{ n: number }>`
    SELECT count(*)::int AS n
      FROM teacher_guardian_links l
      JOIN messages x ON x.teacher_id = l.teacher_id AND x.guardian_id = l.guardian_id
     WHERE ${sql.ref(`l.${viewer.kind}_id`)} = ${viewer.id} AND x.sender = ${other(viewer.kind)}
       AND x.created_at > coalesce(${readCol(viewer.kind)}, '-infinity')`.execute(db);
  return rows[0]?.n ?? 0;
}

export interface ThreadMessage {
  id: string;
  sender: Side | 'system';
  body: string;
  hidden: boolean;
  at: Temporal.Instant;
}

/** As mensagens da conversa, da mais antiga à mais nova, e marca como lidas por quem abriu; null sem vínculo. */
export async function openThread(
  db: Db, pair: { teacherId: string; guardianId: string }, viewer: Side, now: Temporal.Instant,
): Promise<ThreadMessage[] | null> {
  const link = await db.selectFrom('teacher_guardian_links').select('teacher_id')
    .where('teacher_id', '=', pair.teacherId).where('guardian_id', '=', pair.guardianId).executeTakeFirst();
  if (!link) return null;
  const rows = await db.selectFrom('messages').select(['id', 'sender', 'body', 'masked', 'created_at'])
    .where('teacher_id', '=', pair.teacherId).where('guardian_id', '=', pair.guardianId)
    .orderBy('created_at').orderBy('id').execute();
  await sql`UPDATE teacher_guardian_links SET ${sql.ref(`${viewer}_read_at`)} = greatest(${sql.ref(`${viewer}_read_at`)}, ${now.toString()}::timestamptz)
             WHERE teacher_id = ${pair.teacherId} AND guardian_id = ${pair.guardianId}`.execute(db);
  return rows.map((r) => ({
    id: String(r.id), sender: r.sender as ThreadMessage['sender'], body: r.body, hidden: r.masked, at: instantFromDb(r.created_at),
  }));
}

/**
 * Aviso por e-mail de mensagem nova, sem o texto: só se ainda há mensagem não
 * lida e o último aviso desta conversa tem mais de 15 minutos.
 */
export async function notifyNewMessages(
  deps: Deps, input: { teacherId: string; guardianId: string; to: Side }, now: Temporal.Instant,
): Promise<boolean> {
  const { rows } = await sql<{
    t_name: string; t_slug: string; t_email: string | null; g_name: string; g_email: string | null;
    notified_at: string | null; unread: number;
  }>`
    SELECT t.display_name AS t_name, t.slug AS t_slug, t.email AS t_email, g.name AS g_name, g.email AS g_email,
           ${sql.ref(`l.${input.to}_notified_at`)} AS notified_at,
           (SELECT count(*) FROM messages x
             WHERE x.teacher_id = l.teacher_id AND x.guardian_id = l.guardian_id AND x.sender = ${other(input.to)}
               AND x.created_at > coalesce(${readCol(input.to)}, '-infinity'))::int AS unread
      FROM teacher_guardian_links l
      JOIN teachers t ON t.id = l.teacher_id
      JOIN guardians g ON g.id = l.guardian_id
     WHERE l.teacher_id = ${input.teacherId} AND l.guardian_id = ${input.guardianId}`.execute(deps.db);
  const r = rows[0];
  if (!r || r.unread === 0) return false;
  if (r.notified_at && instantFromDb(r.notified_at).epochMilliseconds > now.subtract({ minutes: NOTIFY_EVERY_MIN }).epochMilliseconds) {
    return false;
  }
  const toTeacher = input.to === 'teacher';
  const email = toTeacher ? r.t_email : r.g_email;
  if (!email) return false;
  const from = toTeacher ? shortName(r.g_name) : r.t_name;
  const link = toTeacher
    ? `${deps.config.appBaseUrl}/professor/mensagens/${input.guardianId}`
    : `${deps.config.appBaseUrl}/conta/mensagens/${r.t_slug}`;
  await deps.providers.email.send({
    to: email,
    subject: `Nova mensagem de ${from} na Reforce`,
    text: `${from} mandou ${r.unread === 1 ? 'uma mensagem' : `${r.unread} mensagens`} para você na Reforce.\n\n`
      + `Para ler e responder: ${link}\n\nPara proteger o aluno e a família, a conversa fica no site.`,
  });
  await sql`UPDATE teacher_guardian_links SET ${sql.ref(`${input.to}_notified_at`)} = ${now.toString()}::timestamptz
             WHERE teacher_id = ${input.teacherId} AND guardian_id = ${input.guardianId}`.execute(deps.db);
  return true;
}
