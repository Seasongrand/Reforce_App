import { BENEFITS, BENEFITS_TITLE } from './content';
import { Icon } from './Icon';

export function Benefits() {
  return (
    <section className="bg-violet-50 px-5 py-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <h2 className="max-w-3xl font-display text-[clamp(1.875rem,4vw,2.75rem)] font-bold tracking-tight">{BENEFITS_TITLE}</h2>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-4">
          {BENEFITS.map((b) => (
            <li key={b.title} className="flex flex-col gap-3 rounded-[20px] border border-site-line bg-white p-6">
              <span className="flex size-12 items-center justify-center rounded-[14px] bg-indigo-600 text-white">
                <Icon name={b.icon} />
              </span>
              <h3 className="text-lg font-semibold">{b.title}</h3>
              <p className="text-[15px] leading-relaxed text-site-muted">{b.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
