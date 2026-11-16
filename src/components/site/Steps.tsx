import { STEPS, STEPS_TITLE } from './content';

export function Steps() {
  return (
    <section id="como" className="scroll-mt-4 px-5 py-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <h2 className="font-display text-[clamp(1.875rem,4vw,2.75rem)] font-bold tracking-tight">{STEPS_TITLE}</h2>
        <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-7">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-2.5">
              <span aria-hidden="true" className="font-display text-6xl font-bold leading-none text-indigo-600">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="text-[15px] leading-relaxed text-site-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
