import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { AccountLessonCard } from '@/components/aluno/AccountLessonCard';
import { RescheduleForm } from '@/components/aluno/RescheduleForm';
import { accountView } from '@/domain/guardians/account';
import { changeOptions, rescheduleSlots } from '@/domain/lessons/change';
import { formatBRL } from '@/lib/money';
import { formatPtBr } from '@/time/zoned';
import { appDeps, now } from '@/server/app';
import { requireGuardian } from '@/server/session';
import { cancelLessonAction, rescheduleAction } from '../../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Remarcar ou cancelar · Minha conta · Reforce' };

const CARD = 'space-y-4 rounded-3xl border border-site-line bg-white p-5';

/** Remarcar ou cancelar uma aula paga (24 horas ou mais: cancela com devolução; menos: só remarca). */
export default async function ChangeLesson({ params }: { params: Promise<{ booking: string }> }) {
  const guardianId = await requireGuardian();
  const { booking } = await params;
  const deps = appDeps();
  const at = await now();
  const options = await changeOptions(deps.db, guardianId, booking, at);
  if (!options) notFound();
  const v = await accountView(deps, guardianId, at);
  const l = v.upcoming.find((x) => x.bookingId === booking);
  if (!l) notFound();
  const slots = (await rescheduleSlots(deps, guardianId, booking, at)).map(String);
  return (
    <div className="space-y-6">
      <Link href="/conta/aulas" className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo-600">← Aulas</Link>
      <h1 className="font-display text-3xl font-bold">Remarcar ou cancelar</h1>
      <ul><AccountLessonCard l={l} tz={v.timezone} /></ul>
      <p className="rounded-2xl bg-violet-50 px-4 py-3 text-sm">
        {options.canCancel
          ? <>Cancelamento com devolução integral até <strong>{formatPtBr(options.freeCancelUntil, v.timezone)}</strong> (24 horas antes da aula). Depois disso, dá para remarcar.</>
          : <>Faltam menos de 24 horas para a aula: dá para remarcar, sem devolução.</>}
      </p>

      <section className={CARD} aria-labelledby="remarcar">
        <div className="space-y-1">
          <h2 id="remarcar" className="font-display text-xl font-bold">Remarcar</h2>
          <p className="text-sm text-site-muted">
            {options.canReschedule
              ? `Escolha outro horário de ${l.teacherName}, sem pagar de novo. ${options.reschedulesLeft === 1 ? 'Esta aula ainda pode ser remarcada 1 vez.' : `Esta aula pode ser remarcada até ${options.reschedulesLeft} vezes.`}`
              : 'Esta aula já foi remarcada 2 vezes e não pode ser remarcada de novo.'}
          </p>
        </div>
        {options.canReschedule && <RescheduleForm bookingId={booking} slots={slots} tz={v.timezone} action={rescheduleAction} />}
      </section>

      {options.canCancel && (
        <section className={CARD} aria-labelledby="cancelar">
          <div className="space-y-1">
            <h2 id="cancelar" className="font-display text-xl font-bold">Cancelar</h2>
            <p className="text-sm text-site-muted">Devolvemos {formatBRL(options.refundCents)} pelo mesmo meio de pagamento, e {l.teacherName} é avisado na hora.</p>
          </div>
          <ActionForm action={cancelLessonAction} submitLabel={`Cancelar a aula e receber ${formatBRL(options.refundCents)}`} className="space-y-3"
            buttonClassName="inline-flex min-h-12 items-center rounded-2xl border border-red-300 bg-white px-5 font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50">
            <input type="hidden" name="bookingId" value={booking} />
            <label className="flex min-h-11 items-start gap-2.5 text-sm">
              <input type="checkbox" name="confirm" required className="mt-0.5 size-5 flex-none accent-indigo-600" />
              Confirmo o cancelamento desta aula.
            </label>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
