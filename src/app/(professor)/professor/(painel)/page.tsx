import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { CopyButton } from '@/components/aluno/CopyButton';
import { teacherDashboard } from '@/domain/teachers/dashboard';
import { formatPtBr } from '@/time/zoned';
import { appDeps, now } from '@/server/app';
import { requireTeacher } from '@/server/session';
import { submitForReviewAction } from './actions';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, string> = {
  draft: 'Cadastro em preenchimento',
  in_review: 'Em análise pela equipe',
  approved: 'Aprovado',
  paused: 'Pausado',
  suspended: 'Suspenso',
};
const MODALITY: Record<string, string> = { online: 'online', at_teacher: 'no seu endereço', at_student: 'na casa do aluno' };
const CARD = 'rounded-2xl border border-site-line bg-white p-5 sm:p-6';
const SHARE = 'inline-flex min-h-11 items-center rounded-xl border border-site-field px-4 text-sm font-semibold hover:bg-violet-50';

function Check({ done }: { done: boolean }) {
  return (
    <span aria-hidden="true"
      className={`flex size-7 flex-none items-center justify-center rounded-full ${done ? 'bg-green-600 text-white' : 'border-2 border-site-field'}`}>
      {done && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </span>
  );
}

/** Início da área do professor: o que falta para vender aulas, as próximas aulas e a página pública. */
export default async function TeacherHome() {
  const teacherId = await requireTeacher();
  const d = await teacherDashboard(appDeps(), teacherId, await now());
  const pct = Math.round((d.done / d.total) * 100);
  const share = d.pageUrl && {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`Agende suas aulas comigo pela Reforce: ${d.pageUrl}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(d.pageUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(d.pageUrl)}`,
  };
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight">Olá, {d.firstName}</h1>
        <p className="text-[15px] text-site-muted">
          Situação: <strong className="text-indigo-950" data-testid="teacher-status">{STATUS[d.status] ?? d.status}</strong>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className={`${CARD} space-y-4`} aria-labelledby="passos">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="passos" className="font-display text-xl font-bold">Seus passos até a primeira aula</h2>
              <span className="flex-none whitespace-nowrap text-sm font-semibold text-site-muted" data-testid="progresso">{d.done} de {d.total}</span>
            </div>
            <div className="h-2 rounded-full bg-site-line" aria-hidden="true">
              <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <ol className="divide-y divide-site-line">
            {d.steps.map((s) => (
              <li key={s.key} className="flex items-center gap-3 py-3" data-testid={`passo-${s.key}`}>
                <Check done={s.done} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{s.label}<span className="sr-only">{s.done ? ' (feito)' : ' (falta)'}</span></p>
                  <p className="text-[13px] text-site-muted">{s.detail}</p>
                </div>
                {s.href !== '/professor' && (
                  <Link href={s.href} className="flex-none text-sm font-semibold text-indigo-600 underline">
                    {s.done ? 'Ver' : 'Fazer'}
                  </Link>
                )}
              </li>
            ))}
          </ol>
          {d.canSubmit && (
            <ActionForm action={submitForReviewAction} submitLabel="Enviar para análise" className="space-y-2">
              <p className="text-sm text-site-muted">Tudo pronto. A equipe confere seus documentos e a sua foto.</p>
            </ActionForm>
          )}
        </section>

        <div className="space-y-6">
          <section className={`${CARD} space-y-3`} aria-labelledby="proximas">
            <h2 id="proximas" className="font-display text-xl font-bold">Próximas aulas</h2>
            {d.upcoming.length === 0 ? (
              <p className="text-[15px] text-site-muted">Nenhuma aula marcada ainda. Divulgue sua página para seus alunos.</p>
            ) : (
              <ul className="space-y-2">
                {d.upcoming.map((l) => (
                  <li key={l.bookingId} className="rounded-xl bg-violet-50 px-3.5 py-2.5 text-sm">
                    <p className="font-semibold">{formatPtBr(l.startsAt, d.timezone)}</p>
                    <p className="text-site-muted">{l.subject} com {l.studentFirstName} · {MODALITY[l.modality]}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/professor/aulas" className="inline-block text-sm font-semibold text-indigo-600 underline">Ver todas as aulas</Link>
          </section>

          <section className={`${CARD} space-y-3`} aria-labelledby="pagina">
            <h2 id="pagina" className="font-display text-xl font-bold">Sua página</h2>
            {d.pageUrl && share ? (
              <>
                <a href={d.pageUrl} id="pagina-endereco" className="block break-all text-[15px] font-semibold text-indigo-600 underline" data-testid="pagina-link">
                  {d.pageUrl}
                </a>
                <p className="text-sm text-site-muted">Mande para seus alunos: quem chega pelo seu link paga a comissão menor.</p>
                <div className="flex flex-wrap gap-2">
                  <a className={SHARE} href={share.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
                  <a className={SHARE} href={share.facebook} target="_blank" rel="noreferrer">Facebook</a>
                  <a className={SHARE} href={share.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
                  <CopyButton text={d.pageUrl} label="Copiar link" copiedLabel="Link copiado" className={SHARE} targetId="pagina-endereco" />
                </div>
              </>
            ) : (
              <p className="text-[15px] text-site-muted" data-testid="pagina-aviso">
                Sua página entra no ar depois da aprovação da equipe. Enquanto isso, monte o perfil em{' '}
                <Link href="/professor/cadastro" className="font-semibold text-indigo-600 underline">Meu perfil</Link>.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
