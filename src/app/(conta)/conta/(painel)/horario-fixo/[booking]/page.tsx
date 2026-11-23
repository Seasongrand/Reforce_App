import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Temporal } from 'temporal-polyfill';
import { ActionForm } from '@/components/ActionForm';
import { AccountLessonCard } from '@/components/aluno/AccountLessonCard';
import { CHARGE_LEAD_DAYS, MAX_UNPAID_IN_ROW, PAY_UNTIL_HOURS } from '@/domain/booking/weekly';
import { accountView } from '@/domain/guardians/account';
import { appDeps, now } from '@/server/app';
import { requireGuardian } from '@/server/session';
import { startWeeklyAction } from '../../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Horário fixo · Minha conta · Reforce' };

const WEEKDAYS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];

/** Ligar o horário fixo semanal a partir de uma aula paga: as regras, em linguagem simples, e a confirmação. */
export default async function WeeklyPage({ params }: { params: Promise<{ booking: string }> }) {
  const guardianId = await requireGuardian();
  const { booking } = await params;
  const v = await accountView(appDeps(), guardianId, await now());
  const l = v.upcoming.find((x) => x.bookingId === booking);
  if (!l || l.seriesId) notFound();
  const z = Temporal.Instant.from(l.startsAt).toZonedDateTimeISO(v.timezone);
  const weekday = WEEKDAYS[z.dayOfWeek - 1]!;
  const local = `${String(z.hour).padStart(2, '0')}:${String(z.minute).padStart(2, '0')}`;
  return (
    <div className="space-y-6">
      <Link href="/conta/aulas" className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-600">← Aulas</Link>
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl font-normal tracking-tight">Repetir toda semana</h1>
        <p className="text-site-muted">Toda {weekday}, às {local}, com {l.teacherName}, para {l.studentFirstName}.</p>
      </div>
      <ul><AccountLessonCard l={l} tz={v.timezone} /></ul>
      <section className="space-y-3 rounded-[20px] bg-violet-50 p-5 text-[15px]" aria-labelledby="como">
        <h2 id="como" className="font-medium">Como funciona</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>O horário da semana seguinte fica reservado para vocês. Nenhuma outra família consegue marcar.</li>
          <li>{CHARGE_LEAD_DAYS} dias antes de cada aula, chega o PIX da semana por e-mail e WhatsApp. Cada aula é paga separadamente.</li>
          <li>Se não pagar até {PAY_UNTIL_HOURS} horas antes, só aquela aula é cancelada, e o horário fica livre naquela semana.</li>
          <li>Depois de {MAX_UNPAID_IN_ROW} semanas seguidas sem pagamento, o horário fixo é encerrado.</li>
          <li>Você pode encerrar quando quiser, na tela de aulas. As aulas já pagas continuam marcadas.</li>
        </ul>
      </section>
      <ActionForm action={startWeeklyAction} submitLabel="Quero toda semana" className="space-y-3"
        buttonClassName="inline-flex min-h-12 items-center rounded-lg bg-indigo-600 px-5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        <input type="hidden" name="bookingId" value={booking} />
      </ActionForm>
    </div>
  );
}
