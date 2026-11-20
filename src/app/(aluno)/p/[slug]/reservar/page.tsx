import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Temporal } from 'temporal-polyfill';
import { BookingForm } from '@/components/BookingForm';
import { LessonSummary } from '@/components/aluno/LessonSummary';
import { LocalWhen } from '@/components/aluno/LocalWhen';
import { Stepper } from '@/components/aluno/Stepper';
import { bookingGrades } from '@/domain/public/booking-grades';
import { publicTeacherPage } from '@/domain/public/teacher-page';
import { appDeps, now } from '@/server/app';
import { currentSubject } from '@/server/session';
import { confirmAndHoldAction, holdAsGuardianAction, identifyAction } from './actions';

export const dynamic = 'force-dynamic';

const MODALITY: Record<string, string> = { online: 'online', at_teacher: 'no endereço do professor', at_student: 'na sua casa' };

export default async function ReservePage({
  params, searchParams,
}: { params: Promise<{ slug: string }>; searchParams: Promise<{ servico?: string; inicio?: string; serie?: string }> }) {
  const { slug } = await params;
  const { servico, inicio, serie } = await searchParams;
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
  const grades = bookingGrades({ teaches: page.subjects, subject: service.subject, wanted: serie });
  return (
    <div className="space-y-5">
      <Link href={`/p/${slug}`} className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-600">← {page.name}</Link>
      <Stepper current={2} />
      <LessonSummary
        photoUrl={page.photoUrl} teacherName={page.name} subject={service.subject} priceCents={service.priceCents}
        when={<><LocalWhen iso={start.toString()} teacherTz={page.timezone} /> · {MODALITY[service.modality]} · {service.durationMin} min</>} />
      {!stillFree && (
        <p className="notice">Este horário pode não estar mais livre. Se estiver ocupado, mostramos os mais próximos.</p>
      )}
      <BookingForm
        slug={slug} serviceId={service.id} startsAt={start.toString()} idempotencyKey={randomUUID()}
        atStudent={service.modality === 'at_student'} grades={grades.grades} selectedGrade={grades.selected}
        loggedIn={guardianId !== null} students={students} addresses={addresses}
        holdMinutes={deps.config.holdMinutes}
        identify={identifyAction} confirmAndHold={confirmAndHoldAction} holdAsGuardian={holdAsGuardianAction} />
    </div>
  );
}
