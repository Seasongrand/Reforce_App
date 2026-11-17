import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Icon, type IconName } from '@/components/site/Icon';
import { StudentWaitlistForm } from '@/components/site/StudentWaitlistForm';
import { config } from '@/config';
import { STAGES, WAITLIST_SUBJECTS } from '@/domain/waitlist';
import { joinStudentWaitlistAction } from '../actions';

export const dynamic = 'force-dynamic';

const title = 'Entrar · Reforce';
const description =
  'A Reforce abre em breve para alunos: aulas particulares com professores verificados e pagamento protegido. Deixe seu e-mail e avisamos.';
export const metadata: Metadata = { title, description, openGraph: { title, description } };

const PROMISES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'shield', title: 'Professores verificados', text: 'Identidade, antecedentes criminais e formação conferidos.' },
  { icon: 'card', title: 'Pagamento protegido', text: 'O valor só vai para o professor depois da aula. Se ele faltar, o dinheiro volta.' },
  { icon: 'video', title: 'Online ou presencial', text: 'Na sala da Reforce, direto no navegador, ou na sua casa.' },
];

/**
 * Botão "Entrar" do topo. Enquanto a plataforma não abre, o aluno pede aviso
 * da abertura; com o marketplace aberto, vai para o login de "Minha conta".
 */
export default function StudentEntryPage() {
  const cfg = config();
  if (cfg.siteMode === 'completo') redirect('/conta/entrar');
  return (
    <>
      <section className="bg-indigo-950 px-5 pb-20 pt-10 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start gap-12">
          <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-6">
            <span className="self-start rounded-lg border border-indigo-700 px-3.5 py-2 text-sm font-medium text-site-on-dark">
              Para alunos e responsáveis
            </span>
            <h1 className="font-display text-[clamp(2.25rem,5vw,3.5rem)] font-bold leading-[1.12] tracking-tight">
              A Reforce abre em breve para alunos
            </h1>
            <p className="text-lg leading-relaxed text-site-on-dark">
              Estamos selecionando os primeiros professores. Deixe seu e-mail e avisamos quando der para reservar aulas na sua
              cidade.
            </p>
            <ul className="flex flex-col gap-4">
              {PROMISES.map((p) => (
                <li key={p.title} className="flex items-start gap-3.5">
                  <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-indigo-900 text-yellow-400">
                    <Icon name={p.icon} size={20} />
                  </span>
                  <div>
                    <p className="font-semibold">{p.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-site-on-dark">{p.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0 flex-[1_1_26rem] rounded-[22px] bg-white p-5 text-indigo-950 sm:p-9">
            <StudentWaitlistForm
              action={joinStudentWaitlistAction}
              subjects={WAITLIST_SUBJECTS.map((s) => ({ value: String(s.id), label: s.name }))}
              stages={Object.entries(STAGES).map(([value, label]) => ({ value, label }))}
              teachersUrl={`${cfg.appBaseUrl}/professores`}
            />
          </div>
        </div>
      </section>
      <section className="px-5 py-12">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 rounded-[22px] border border-site-line p-6">
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold">É professor?</h2>
            <p className="text-site-muted">Entre na lista de espera e seja um dos primeiros a dar aula pela Reforce.</p>
          </div>
          <Link
            href="/professores"
            className="inline-flex min-h-12 items-center rounded-2xl bg-yellow-400 px-6 font-semibold text-indigo-950 hover:bg-yellow-300"
          >
            Quero dar aula
          </Link>
        </div>
      </section>
    </>
  );
}
