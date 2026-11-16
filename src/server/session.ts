/**
 * Sessões nos cookies: um cookie por tipo de usuário, httpOnly e SameSite=Lax.
 * O aluno não tem login; o responsável entra pelo checkout.
 */
import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { deleteSession, getSession, SESSION_TTL_DAYS, type SubjectType } from '@/domain/auth/sessions';
import { appDeps, now } from './app';

const COOKIE: Record<SubjectType, string> = {
  teacher: 'sessao_professor',
  staff: 'sessao_equipe',
  guardian: 'sessao_familia',
};

export async function setSessionCookie(type: SubjectType, token: string): Promise<void> {
  (await cookies()).set(COOKIE[type], token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: appDeps().config.nodeEnv === 'production',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function currentSubject(type: SubjectType): Promise<string | null> {
  const token = (await cookies()).get(COOKIE[type])?.value;
  const s = await getSession(appDeps().db, token, await now());
  return s && s.subjectType === type ? s.subjectId : null;
}

export async function endSession(type: SubjectType): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE[type])?.value;
  if (token) await deleteSession(appDeps().db, token);
  jar.delete(COOKIE[type]);
}

export async function requireTeacher(): Promise<string> {
  const id = await currentSubject('teacher');
  if (!id) redirect('/professor/entrar');
  return id;
}

export async function requireStaff(): Promise<string> {
  const id = await currentSubject('staff');
  if (!id) redirect('/interno/entrar');
  return id;
}
