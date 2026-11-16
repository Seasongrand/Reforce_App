/** Sessões: o cookie leva um token aleatório; o banco guarda só o SHA-256 dele. */
import { createHash, randomBytes } from 'node:crypto';
import { sql } from 'kysely';
import type { Temporal } from 'temporal-polyfill';
import type { Db } from '@/db/client';

export type SubjectType = 'teacher' | 'guardian' | 'staff';
export const SESSION_TTL_DAYS = 30;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(db: Db, subjectType: SubjectType, subjectId: string, now: Temporal.Instant): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await sql`INSERT INTO sessions (token_hash, subject_type, subject_id, expires_at, created_at)
            VALUES (${hash(token)}, ${subjectType}, ${subjectId},
                    ${now.add({ hours: 24 * SESSION_TTL_DAYS }).toString()}::timestamptz, ${now.toString()}::timestamptz)`
    .execute(db);
  return token;
}

export async function getSession(
  db: Db,
  token: string | undefined,
  now: Temporal.Instant,
): Promise<{ subjectType: SubjectType; subjectId: string } | null> {
  if (!token) return null;
  const { rows } = await sql<{ subject_type: SubjectType; subject_id: string }>`
    SELECT subject_type, subject_id FROM sessions
     WHERE token_hash = ${hash(token)} AND expires_at > ${now.toString()}::timestamptz`.execute(db);
  const r = rows[0];
  return r ? { subjectType: r.subject_type, subjectId: r.subject_id } : null;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await sql`DELETE FROM sessions WHERE token_hash = ${hash(token)}`.execute(db);
}
