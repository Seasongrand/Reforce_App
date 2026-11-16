import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Temporal } from 'temporal-polyfill';
import { BookingForm } from '@/components/BookingForm';
import { GRADE_LEVELS } from '@/domain/catalog';
import { publicTeacherPage } from '@/domain/public/teacher-page';
import { formatBRL } from '@/lib/money';
import { formatPtBr } from '@/time/zoned';
import { appDeps, now } from '@/server/app';
import { currentSubject } from '@/server/session';
import { confirmAndHoldAction, holdAsGuardianAction, identifyAction } from './actions';

export const dynamic = 'force-dynamic';

const MODALITY: Record<string, string> = { online: 'online', at_teacher: 'no endereço do professor', at_student: 'na sua casa' };

export default async function ReservePage({
  params, searchParams,
}: { params: Promise<{ slug: string }>; searchParams: Promise<{ servico?: string; inicio?: string }> }) {
  const { slug } = await params;
  const { servico, inicio } = await searchParams;
  const deps = appDeps();
  const page = await publicTeacherPage(deps, slug, await now());
  if (!page || !page.sellable) notFound();
  const service = page.services.find((s) => s.id === servico);
  let start: Temporal.Instant | null = null;
  try {
    start = inicio ? Temporal.Instant.from(inicio) : null;
  } catch {
    start = null;
  }
  if (!service || !start) notFound();

  const guardianId = await currentSubject('guardian');
  const students = guardianId
    ? (await deps.db.selectFrom('students').select(['id', 'first_name']).where('guardian_id', '=', guardianId).execute())
        .map((s) => ({ id: s.id, firstName: s.first_name }))
    : [];
  const addresses = guardianId
    ? (await deps.db.selectFrom('addresses').select(['id', 'street', 'number', 'city']).where('guardian_id', '=', guardianId).execute())
        .map((a) => ({ id: a.id, label: `${a.street}${a.number ? `, ${a.number}` : ''}, ${a.city}` }))
    : [];
  const stillFree = service.slots.includes(start.toString());

  return (
    <div className="space-y-6">
      <Link href={`/p/${slug}`} className="text-sm text-brand">← {page.name}</Link>
      <h1 className="text-2xl font-semibold">Reservar aula</h1>
      <div className="card text-sm" data-testid="resumo-reserva">
        <p><strong>{service.subject}</strong> com {page.name}, {MODALITY[service.modality]}, {service.durationMin} minutos</p>
        <p>{formatPtBr(start, page.timezone)} (horário de {page.timezone === 'America/Sao_Paulo' ? 'São Paulo' : page.timezone})</p>
        <p>{formatBRL(service.priceCents)}</p>
      </div>
      {!stillFree && <p className="notice">Este horário pode não estar mais livre. Se estiver ocupado, mostramos os mais próximos.</p>}
      <BookingForm
        slug={slug} serviceId={service.id} startsAt={start.toString()} idempotencyKey={randomUUID()}
        atStudent={service.modality === 'at_student'} grades={GRADE_LEVELS.map((g) => ({ slug: g.slug, name: g.name }))}
        loggedIn={guardianId !== null && students.length > 0} students={students} addresses={addresses}
        identify={identifyAction} confirmAndHold={confirmAndHoldAction} holdAsGuardian={holdAsGuardianAction} />
      <p className="text-xs text-slate-500">
        Ao reservar, o horário fica preso por {deps.config.holdMinutes} minutos enquanto você paga.
      </p>
    </div>
  );
}
