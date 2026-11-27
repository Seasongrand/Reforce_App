import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Temporal } from 'temporal-polyfill';
import { ActionForm } from '@/components/ActionForm';
import { AccountLessonCard } from '@/components/aluno/AccountLessonCard';
import { accountView } from '@/domain/guardians/account';
import { DISPUTE_REASONS, disputeState } from '@/domain/lessons/dispute';
import { formatPtBr } from '@/time/zoned';
import { appDeps, now } from '@/server/app';
import { requireGuardian } from '@/server/session';
import { disputeAction } from '../../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Contestar a aula · Minha conta · Reforce' };

/** Contestar uma aula encerrada, em até 2 horas: o valor fica retido até a equipe decidir. */
export default async function DisputePage({ params }: { params: Promise<{ booking: string }> }) {
  const guardianId = await requireGuardian();
  const { booking } = await params;
  const deps = appDeps();
  const at = await now();
  const v = await accountView(deps, guardianId, at);
  const l = v.past.find((x) => x.bookingId === booking);
  if (!l) notFound();
  const state = await disputeState(deps.db, guardianId, booking, at);
  if (!state.canOpen || !state.openUntil) redirect('/conta/aulas?aba=anteriores');
  return (
    <div className="space-y-6">
      <Link href="/conta/aulas?aba=anteriores" className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-600">← Aulas</Link>
      <div className="space-y-1.5">
        <h1 className="font-display tracking-tight text-3xl font-normal">Contestar a aula</h1>
        <p className="text-site-muted">
          Conte o que deu errado até <strong className="font-medium text-indigo-950">{formatPtBr(Temporal.Instant.from(state.openUntil), v.timezone)}</strong>.
          O valor da aula fica guardado, sem ir para o professor, até a equipe da Reforce analisar o registro da aula.
          A resposta chega por e-mail.
        </p>
      </div>
      <ul><AccountLessonCard l={l} tz={v.timezone} /></ul>
      <ActionForm action={disputeAction} submitLabel="Enviar contestação" className="space-y-4 rounded-[20px] border border-site-line bg-white p-5"
        buttonClassName="inline-flex min-h-12 items-center rounded-lg bg-indigo-600 px-5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        <input type="hidden" name="bookingId" value={booking} />
        <fieldset className="space-y-2">
          <legend className="mb-1 font-medium">O que aconteceu?</legend>
          {Object.entries(DISPUTE_REASONS).map(([value, label], i) => (
            <label key={value} className="flex min-h-11 items-center gap-2.5 rounded-lg border border-site-line px-3 text-[15px] has-[:checked]:border-indigo-600 has-[:checked]:bg-violet-50">
              <input type="radio" name="reason" value={value} required defaultChecked={i === 0} className="size-5 flex-none accent-indigo-600" />
              {label}
            </label>
          ))}
        </fieldset>
        <label className="block space-y-1.5">
          <span className="font-medium">Detalhes</span>
          <span className="block text-sm text-site-muted">Obrigatório em “Outro motivo”. Não escreva telefone nem endereço.</span>
          <textarea name="details" rows={4} maxLength={1000}
            className="block w-full rounded-lg border border-site-field bg-white px-3 py-2 text-[15px] focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/30" />
        </label>
      </ActionForm>
    </div>
  );
}
