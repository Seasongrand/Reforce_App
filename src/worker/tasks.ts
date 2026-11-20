/**
 * Tarefas do Graphile Worker. Cada uma lê o "agora" do relógio e chama uma
 * função de domínio; a lógica fica toda em src/domain.
 */
import { Logger, runOnce, type TaskList } from 'graphile-worker';
import type { Deps } from '@/domain/deps';
import { createCalendarEvent, createVideoRoom, refreshAllListed, refreshTeacher } from '@/domain/jobs';
import { notifyNewMessages } from '@/domain/messages';
import { refundPayment } from '@/domain/payment/refund';
import { runMinuteSweeps } from '@/domain/sweeps';
import { expireVerifications } from '@/domain/staff/review';
import type { Clock } from '@/time/clock';

type ClockSource = () => Clock | Promise<Clock>;

const str = (payload: unknown, key: string): string => {
  const v = (payload as Record<string, unknown> | null)?.[key];
  if (typeof v !== 'string') throw new Error(`tarefa sem ${key}`);
  return v;
};

export function buildTaskList(makeDeps: () => Deps, clock: ClockSource): TaskList {
  const withNow = async <T>(fn: (deps: Deps, now: ReturnType<Clock['now']>) => Promise<T>) =>
    fn(makeDeps(), (await clock()).now());
  return {
    'payment.refund': async (p) => {
      const amount = (p as Record<string, unknown> | null)?.amountCents;
      await withNow((d, n) => refundPayment(d, str(p, 'paymentId'), n, typeof amount === 'number' ? amount : undefined));
    },
    'video.create_room': async (p) => { await withNow((d, n) => createVideoRoom(d, str(p, 'bookingId'), n)); },
    'calendar.create_event': async (p) => { await withNow((d, n) => createCalendarEvent(d, str(p, 'bookingId'), n)); },
    'search.refresh_teacher': async (p) => { await withNow((d, n) => refreshTeacher(d, str(p, 'teacherId'), n)); },
    'message.notify': async (p) => {
      const to = str(p, 'to');
      if (to !== 'teacher' && to !== 'guardian') throw new Error('tarefa com destinatário inválido');
      await withNow((d, n) => notifyNewMessages(d, { teacherId: str(p, 'teacherId'), guardianId: str(p, 'guardianId'), to }, n));
    },
    'sweep_minute': async () => { await withNow(runMinuteSweeps); },
    'sweep_refresh_all': async () => { await withNow(refreshAllListed); },
    'sweep_daily': async () => { await withNow(expireVerifications); },
  };
}

/** Agenda das varreduras (fuso UTC do Graphile Worker). */
export const CRONTAB = [
  '* * * * * sweep_minute ?max=1',
  '7 * * * * sweep_refresh_all ?max=1',
  '13 9 * * * sweep_daily ?max=1', // 06h13 em São Paulo
].join('\n');

export const quietLogger = new Logger(() => () => {});

/** Processa o que estiver na fila e volta (testes e /dev). */
export async function runQueuedJobsOnce(connectionString: string, makeDeps: () => Deps, clock: Clock): Promise<void> {
  await runOnce({
    connectionString,
    taskList: buildTaskList(makeDeps, () => clock),
    logger: quietLogger,
    noHandleSignals: true,
  });
}
