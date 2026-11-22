import { formatBRL } from '@/lib/money';
import { TeacherPhoto } from './TeacherPhoto';

/** Resumo da aula escolhida, presente em todos os passos da reserva. */
export function LessonSummary({
  photoUrl, teacherName, subject, when, priceCents,
}: { photoUrl: string | null; teacherName: string; subject: string; when: React.ReactNode; priceCents: number }) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] bg-violet-50 p-3.5" data-testid="resumo-reserva">
      <TeacherPhoto photoUrl={photoUrl} name={teacherName} size={52} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{subject} com {teacherName}</p>
        <p className="mt-0.5 text-sm text-site-muted">{when}</p>
      </div>
      <strong className="text-base">{formatBRL(priceCents)}</strong>
    </div>
  );
}
