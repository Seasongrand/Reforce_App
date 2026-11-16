/**
 * Link da aula para a família (o aluno não tem login): assinado com segredo,
 * com papel e validade. Abre a página da aula com a sala ou o código presencial.
 */
import type { Temporal } from 'temporal-polyfill';
import { hmacHex, safeEqualHex } from '@/providers/signing';

export type LessonRole = 'student';

export function lessonToken(bookingId: string, role: LessonRole, validUntil: Temporal.Instant, secret: string): string {
  const exp = Math.floor(validUntil.epochMilliseconds / 1000);
  const body = Buffer.from(`${bookingId}|${role}|${exp}`).toString('base64url');
  return `${body}.${hmacHex(secret, `lesson|${body}`).slice(0, 40)}`;
}

export function verifyLessonToken(
  token: string,
  secret: string,
  now: Temporal.Instant,
): { bookingId: string; role: LessonRole } | null {
  const [body, sig] = token.split('.');
  if (!body || !sig || !safeEqualHex(sig, hmacHex(secret, `lesson|${body}`).slice(0, 40))) return null;
  const [bookingId, role, exp] = Buffer.from(body, 'base64url').toString('utf8').split('|');
  if (!bookingId || role !== 'student' || !exp) return null;
  if (Math.floor(now.epochMilliseconds / 1000) > Number(exp)) return null;
  return { bookingId, role };
}
