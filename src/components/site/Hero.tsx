import { HERO } from './content';
import { Icon } from './Icon';

const EXAMPLE_TONE = ['bg-green-100 text-green-800', 'bg-indigo-100 text-indigo-800', 'bg-amber-100 text-amber-800'];

export function Hero() {
  return (
    <section className="bg-indigo-950 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-12 px-5 pb-20 pt-10">
        <div className="flex min-w-0 flex-[1_1_28rem] flex-col gap-6">
          <span className="self-start rounded-lg border border-indigo-700 px-3.5 py-2 text-sm font-medium text-site-on-dark">
            {HERO.badge}
          </span>
          <h1 className="font-display text-[clamp(2.5rem,6vw,4.25rem)] font-bold leading-[1.12] tracking-tight">
            <span className="block">{HERO.titleFirst}</span>
            {HERO.titleBefore}
            {/* inline-block com altura própria: a faixa amarela não sobe até a perna do "g" da linha de cima */}
            <mark className="mt-[0.14em] inline-block whitespace-nowrap rounded-lg bg-yellow-400 px-2 py-[0.04em] leading-none text-indigo-950">
              {HERO.titleMark}
            </mark>
            {HERO.titleAfter}
          </h1>
          <p className="text-lg leading-relaxed text-site-on-dark">{HERO.lead}</p>
          <div className="flex flex-wrap gap-3">
            <a
              href="#lista"
              className="inline-flex min-h-14 items-center rounded-2xl bg-yellow-400 px-7 text-lg font-semibold text-indigo-950 hover:bg-yellow-300"
            >
              {HERO.primary}
            </a>
            <a
              href="#como"
              className="inline-flex min-h-14 items-center rounded-2xl border border-indigo-400 px-6 text-lg font-semibold text-white hover:bg-indigo-900"
            >
              {HERO.secondary}
            </a>
          </div>
        </div>
        <ul aria-label="Exemplo do que você recebe" className="flex min-w-0 max-w-md flex-[1_1_22rem] flex-col gap-3.5">
          {HERO.examples.map((e, i) => (
            <li key={e.title} className={`flex items-start gap-3.5 rounded-2xl bg-white p-5 text-indigo-950 ${i === 1 ? 'sm:ml-7' : ''}`}>
              <span className={`flex size-10 flex-none items-center justify-center rounded-xl ${EXAMPLE_TONE[i]}`}>
                <Icon name={e.icon} size={20} />
              </span>
              <div>
                <p className="font-semibold">{e.title}</p>
                <p className="mt-1 text-sm text-site-muted">{e.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
