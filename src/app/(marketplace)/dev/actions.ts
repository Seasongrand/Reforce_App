'use server';

import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';
import { sql } from 'kysely';
import { devToolsEnabled } from '@/domain/dev';
import { expireVerifications } from '@/domain/staff/review';
import { runMinuteSweeps } from '@/domain/sweeps';
import { advanceDevClock, getClock, setDevClockOffset } from '@/time/dev-clock';
import { runQueuedJobsOnce } from '@/worker/tasks';
import { appDeps } from '@/server/app';
import { errorMessage, type ActionState } from '@/server/action-result';

function guard() {
  const deps = appDeps();
  if (!devToolsEnabled(deps.config)) notFound();
  return deps;
}

const done = (): ActionState => {
  revalidatePath('/dev');
  return { ok: true, data: undefined };
};

export async function advanceClockAction(_: unknown, f: FormData): Promise<ActionState> {
  const deps = guard();
  const minutes = Number(f.get('minutes') ?? 0);
  if (!Number.isFinite(minutes)) return { ok: false, error: 'minutos inválidos' };
  await advanceDevClock(deps.db, { minutes });
  return done();
}

export async function resetClockAction(): Promise<ActionState> {
  await setDevClockOffset(guard().db, { minutes: 0 });
  return done();
}

/** Roda agora o que o worker faria: varreduras, vencimento de certidões e tarefas na fila. */
export async function runSweepsAction(): Promise<ActionState> {
  const deps = guard();
  try {
    const clock = await getClock(deps.db, { devTools: true });
    await runQueuedJobsOnce(deps.config.databaseUrl, () => deps, clock);
    await runMinuteSweeps(deps, clock.now());
    await expireVerifications(deps, clock.now());
    await runQueuedJobsOnce(deps.config.databaseUrl, () => deps, clock);
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  return done();
}

export async function addBusyAction(_: unknown, f: FormData): Promise<ActionState> {
  const deps = guard();
  try {
    const r = await sql`
      INSERT INTO dev_calendar_busy (teacher_id, during)
      SELECT t.id, tstzrange((${String(f.get('start'))}::timestamp AT TIME ZONE t.timezone),
                             (${String(f.get('end'))}::timestamp AT TIME ZONE t.timezone), '[)')
        FROM teachers t WHERE t.slug = ${String(f.get('slug') ?? '')}`.execute(deps.db);
    if (Number(r.numAffectedRows ?? 0) === 0) return { ok: false, error: 'professor não encontrado' };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  return done();
}
