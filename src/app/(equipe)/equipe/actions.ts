'use server';

/**
 * Atalhos da equipe no modo lista de espera: com a senha da equipe, entram nas
 * áreas fechadas ao público com contas de teste, sem código por e-mail. O
 * proxy já pediu a senha; aqui ela é conferida de novo. No site completo os
 * atalhos não existem: a equipe volta a entrar pelo código no e-mail.
 */
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { config } from '@/config';
import { createSession, type SubjectType } from '@/domain/auth/sessions';
import type { Deps } from '@/domain/deps';
import { teamPasswordMatches } from '@/domain/team-auth';
import { ensureTeamStaff, ensureTestGuardian, ensureTestTeacher } from '@/domain/team-shortcuts';
import { appDeps, now } from '@/server/app';
import { setSessionCookie } from '@/server/session';

async function enter(type: SubjectType, ensure: (deps: Deps) => Promise<string>, to: string): Promise<void> {
  const cfg = config();
  const authorization = (await headers()).get('authorization');
  if (cfg.siteMode !== 'lista_de_espera' || !teamPasswordMatches(cfg.waitlistExportPassword, authorization)) notFound();
  const deps = appDeps();
  const id = await ensure(deps);
  await setSessionCookie(type, await createSession(deps.db, type, id, await now()));
  redirect(to);
}

export async function enterAsStaffAction(): Promise<void> {
  await enter('staff', ensureTeamStaff, '/interno');
}

export async function enterAsTeacherAction(): Promise<void> {
  await enter('teacher', ensureTestTeacher, '/professor');
}

export async function enterAsGuardianAction(): Promise<void> {
  await enter('guardian', ensureTestGuardian, '/conta');
}
