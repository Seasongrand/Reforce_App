import Link from 'next/link';
import { config } from '@/config';
import { SUBJECTS } from '@/domain/catalog';
import { EDUCATION, MODALITIES, STAGES } from '@/domain/waitlist';
import { WaitlistForm } from '@/components/site/WaitlistForm';
import { Benefits } from '@/components/site/Benefits';
import { FORM_LEAD, FORM_TITLE } from '@/components/site/content';
import { Faq } from '@/components/site/Faq';
import { Hero } from '@/components/site/Hero';
import { Steps } from '@/components/site/Steps';
import { joinWaitlistAction } from './actions';

export const dynamic = 'force-dynamic';

const options = (o: Record<string, string>) => Object.entries(o).map(([value, label]) => ({ value, label }));

export default function Home() {
  if (config().siteMode === 'lista_de_espera') return <WaitlistLanding />;
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Reforce</h1>
      <p className="text-slate-700">
        Professores verificados, horário real e pagamento protegido, para alunos do 6º ano ao ensino médio.
      </p>
      <div className="card space-y-2">
        <h2 className="font-medium">Sou professor</h2>
        <p className="text-sm text-slate-600">Cadastre-se, envie seus documentos e monte sua agenda.</p>
        <Link className="btn" href="/professor/entrar">Entrar ou cadastrar</Link>
      </div>
    </div>
  );
}

function WaitlistLanding() {
  return (
    <>
      <Hero />
      <Steps />
      <Benefits />
      <Faq />
      <section id="lista" className="scroll-mt-4 bg-indigo-950 px-5 py-20 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start gap-12">
          <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-3.5">
            <h2 className="font-display text-[clamp(1.875rem,4vw,2.75rem)] font-bold tracking-tight">{FORM_TITLE}</h2>
            <p className="text-lg leading-relaxed text-site-on-dark">{FORM_LEAD}</p>
          </div>
          <div className="min-w-0 flex-[1_1_28rem] rounded-[22px] bg-white p-5 text-indigo-950 sm:p-9">
            <WaitlistForm
              action={joinWaitlistAction}
              subjects={SUBJECTS.map((s) => ({ value: String(s.id), label: s.name }))}
              stages={options(STAGES)}
              modalities={options(MODALITIES)}
              education={options(EDUCATION)}
              inviteUrl={config().appBaseUrl}
            />
          </div>
        </div>
      </section>
    </>
  );
}
