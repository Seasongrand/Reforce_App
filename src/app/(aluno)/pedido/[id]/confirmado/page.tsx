import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ProtectedNote } from '@/components/aluno/ProtectedNote';
import { TeacherPhoto } from '@/components/aluno/TeacherPhoto';
import { PRIMARY, SECONDARY } from '@/components/aluno/ui';
import { GRADE_LEVELS } from '@/domain/catalog';
import { loadMessageContext } from '@/domain/notifications/templates';
import { orderView } from '@/domain/public/order';
import { formatBRL } from '@/lib/money';
import { formatTime, zoneLabel } from '@/time/zoned';
import { appDeps, now } from '@/server/app';
import { currentSubject } from '@/server/session';

export const dynamic = 'force-dynamic';

const WEEKDAY = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
const MONTH = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const MODALITY: Record<string, string> = {
  online: 'Online, na sala da Reforce.',
  at_teacher: 'No endereço do professor.',
  at_student: 'Na sua casa.',
};

export default async function ConfirmedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guardianId = await currentSubject('guardian');
  if (!guardianId) notFound();
  const deps = appDeps();
  const v = await orderView(deps, id, guardianId, await now());
  if (!v) notFound();
  if (v.status !== 'paid') redirect(`/pedido/${id}`);
  const c = await loadMessageContext(deps, v.bookingId);
  const tz = c.guardian.timezone;
  const day = c.startsAt.toZonedDateTimeISO(tz);
  const ends = c.startsAt.add({ minutes: c.durationMin });
  const grade = GRADE_LEVELS.find((g) => g.slug === c.student.grade)?.name ?? c.student.grade;
  const firstName = c.teacher.name.split(/\s+/)[0];
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start gap-3">
        <span className="flex size-15 items-center justify-center rounded-[18px] bg-green-100 text-green-800">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h1 className="font-display tracking-tight text-3xl font-normal" data-testid="aula-confirmada">Aula confirmada!</h1>
        <p className="text-[15px] leading-normal text-site-muted">
          Mandamos tudo por e-mail{c.guardian.phone ? ' e WhatsApp' : ''}. Pagamento de {formatBRL(c.totalCents)} recebido.
        </p>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-site-line">
        <div className="flex items-center gap-3.5 bg-indigo-950 p-4 text-white">
          <div className="w-15 flex-none rounded-xl bg-white py-2 text-center text-indigo-950">
            <p className="text-xs font-medium">{WEEKDAY[day.dayOfWeek - 1]}</p>
            <p className="font-display tracking-tight text-2xl font-normal leading-tight">{day.day}</p>
            <p className="text-xs font-medium">{MONTH[day.month - 1]}</p>
          </div>
          <div>
            <p className="font-display tracking-tight text-[22px] font-normal">{formatTime(c.startsAt, tz)} às {formatTime(ends, tz)}</p>
            <p className="mt-0.5 text-sm text-site-on-dark">horário de {zoneLabel(tz)}</p>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-3">
            <TeacherPhoto photoUrl={v.teacherPhotoUrl} name={c.teacher.name} size={44} />
            <div>
              <p className="font-medium">{v.subject} com {c.teacher.name}</p>
              <p className="mt-0.5 text-[13px] text-site-muted">Aluno: {c.student.firstName}, {grade}</p>
            </div>
          </div>
          <p className="text-sm text-[#3b3870]">{MODALITY[c.modality]}</p>
          {c.modality === 'at_teacher' && c.teacher.teachingAddress && (
            <p className="text-sm">Endereço: <strong>{c.teacher.teachingAddress}</strong></p>
          )}
          {c.modality === 'at_student' && c.familyAddress && (
            <p className="text-sm">O professor vai até {c.familyAddress}. Um adulto deve estar em casa na primeira aula.</p>
          )}
          {c.modality !== 'online' && (
            <p className="text-sm">
              Código da aula, para dizer ao professor na chegada:{' '}
              <strong className="font-display tracking-tight text-xl tracking-[0.3em]" data-testid="codigo">{c.checkinCode}</strong>
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        <a className={PRIMARY} href={c.links.lesson}>Ir para a página da aula</a>
        <a className={SECONDARY} href={`/pedido/${id}/agenda.ics`} download="aula-reforce.ics">Adicionar à minha agenda</a>
      </div>

      <section className="space-y-3">
        <h2 className="font-display tracking-tight text-xl font-normal">No dia da aula</h2>
        <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-normal text-[#3b3870]">
          <li>Lembramos você 24 horas e 1 hora antes.</li>
          {c.modality === 'online' ? (
            <>
              <li>A sala abre 10 minutos antes, pelo link do e-mail ou da página da aula.</li>
              <li>Funciona no navegador do computador ou do celular, sem instalar nada.</li>
            </>
          ) : (
            <li>Na chegada, diga ao professor o código da aula.</li>
          )}
        </ol>
      </section>

      <ProtectedNote>
        <p>
          {c.modality === 'online'
            ? 'Se o professor não entrar na sala em até 15 minutos, o dinheiro volta inteiro, sem precisar pedir.'
            : 'Se o professor não aparecer, fale com a gente: a equipe analisa e devolve o dinheiro.'}
        </p>
      </ProtectedNote>

      <Link href={`/p/${c.teacher.slug}`}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-indigo-950/20 bg-white px-6 text-base font-medium text-indigo-950 transition hover:-translate-y-px hover:bg-violet-50">
        Marcar a próxima aula com {firstName}
      </Link>
    </div>
  );
}
