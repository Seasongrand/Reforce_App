import { config } from '@/config';
import { FAQ_TITLE, faqWithCommission } from './content';

export function Faq() {
  return (
    <section id="perguntas" className="px-5 py-20">
      <div className="mx-auto flex max-w-[54rem] flex-col gap-6">
        <h2 className="font-display text-[clamp(1.875rem,4vw,2.75rem)] font-bold tracking-tight">{FAQ_TITLE}</h2>
        <div className="border-t border-site-line">
          {faqWithCommission(config().commissionBps).map(({ q, a }) => (
            <details key={q} className="group border-b border-site-line">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {q}
                <span
                  aria-hidden="true"
                  className="flex size-8 flex-none items-center justify-center rounded-[10px] bg-violet-50 text-xl text-indigo-600 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mb-5 max-w-2xl text-base leading-relaxed text-site-muted">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
