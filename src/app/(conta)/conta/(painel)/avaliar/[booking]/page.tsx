import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ReviewForm } from '@/components/aluno/ReviewForm';
import { TeacherPhoto } from '@/components/aluno/TeacherPhoto';
import { TITLE } from '@/components/aluno/ui';
import { accountView } from '@/domain/guardians/account';
import { appDeps, now } from '@/server/app';
import { currentSubject } from '@/server/session';
import { reviewAction } from '../../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Avaliar a aula · Reforce' };

export default async function ReviewPage({ params }: { params: Promise<{ booking: string }> }) {
  const guardianId = await currentSubject('guardian');
  if (!guardianId) redirect('/conta/entrar');
  const { booking } = await params;
  const v = await accountView(appDeps(), guardianId, await now());
  const l = v.past.find((x) => x.bookingId === booking);
  if (!l) notFound();
  if (!l.canReview) redirect('/conta/aulas?aba=anteriores');
  return (
    <div className="space-y-5">
      <Link href="/conta/aulas?aba=anteriores" className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-600">← Aulas</Link>
      <div className="flex items-center gap-3">
        <TeacherPhoto photoUrl={l.teacherPhotoUrl} name={l.teacherName} size={56} />
        <div>
          <h1 className={TITLE}>Como foi a aula?</h1>
          <p className="text-sm text-site-muted">{l.subject} com {l.teacherName}</p>
        </div>
      </div>
      <ReviewForm bookingId={l.bookingId} action={reviewAction} />
    </div>
  );
}
