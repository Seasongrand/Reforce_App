/** Cartão de uma aula em Minha conta: professor, quando, onde e para qual aluno; as ações vêm de quem usa. */
import type { AccountLesson } from '@/domain/guardians/account';
import { LocalWhen } from './LocalWhen';
import { TeacherPhoto } from './TeacherPhoto';

const PLACE: Record<AccountLesson['modality'], string> = {
  online: 'online',
  at_student: 'na sua casa',
  at_teacher: 'no endereço do professor',
};

export function Stars({ n }: { n: number }) {
  return <span aria-label={`${n} de 5`} className="tracking-tight text-yellow-500">{'★'.repeat(n)}<span className="text-site-line">{'★'.repeat(5 - n)}</span></span>;
}

export function AccountLessonCard({ l, tz, children }: { l: AccountLesson; tz: string; children?: React.ReactNode }) {
  return (
    <li className="space-y-3 rounded-[20px] border border-site-line bg-white p-5" data-testid={`aula-${l.bookingId}`}>
      <div className="flex items-center gap-3">
        <TeacherPhoto photoUrl={l.teacherPhotoUrl} name={l.teacherName} size={48} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{l.subject} com {l.teacherName}</p>
          <p className="text-sm text-site-muted">
            <LocalWhen iso={l.startsAt} teacherTz={tz} /> · {PLACE[l.modality]} · {l.studentFirstName}
          </p>
        </div>
      </div>
      {children}
    </li>
  );
}
