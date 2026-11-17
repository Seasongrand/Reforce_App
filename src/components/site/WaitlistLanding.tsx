/**
 * Página dos professores (lista de espera): em "/" no modo lista de espera e
 * sempre em "/professores".
 */
import { joinWaitlistAction } from '@/app/(site)/actions';
import { config } from '@/config';
import { EDUCATION, MODALITIES, STAGES, WAITLIST_SUBJECTS } from '@/domain/waitlist';
import { Benefits } from './Benefits';
import { FORM_LEAD, FORM_TITLE } from './content';
import { Faq } from './Faq';
import { Hero } from './Hero';
import { Steps } from './Steps';
import { WaitlistForm } from './WaitlistForm';

const options = (o: Record<string, string>) => Object.entries(o).map(([value, label]) => ({ value, label }));

export function WaitlistLanding() {
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
              subjects={WAITLIST_SUBJECTS.map((s) => ({ value: String(s.id), label: s.name }))}
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
