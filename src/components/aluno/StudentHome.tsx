/**
 * Página inicial com o marketplace aberto: a vitrine de busca para o aluno
 * (inspirada nas plataformas de terapia: busca no topo, como funciona e
 * garantias). A página dos professores fica em /professores.
 */
import Link from 'next/link';
import { GRADE_LEVELS, SUBJECTS } from '@/domain/catalog';
import { ProtectedNote } from './ProtectedNote';
import { SearchForm } from './SearchForm';

const STEPS = [
  { title: 'Escolha o professor', text: 'Perfis verificados, com foto, preço e os horários livres de verdade.' },
  { title: 'Reserve e pague', text: 'PIX ou cartão. O horário fica guardado para você enquanto paga.' },
  { title: 'Faça a aula', text: 'Online, na sala da Reforce, ou presencial, na sua casa ou no endereço do professor.' },
];

export function StudentHome() {
  return (
    <>
      <section className="bg-indigo-950 px-5 pb-16 pt-10 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start gap-10">
          <div className="flex min-w-0 flex-[1_1_24rem] flex-col gap-5">
            <span className="self-start rounded-lg border border-indigo-700 px-3.5 py-2 text-sm font-medium text-site-on-dark">
              Do 6º ano ao ensino médio
            </span>
            <h1 className="font-display text-[clamp(2.25rem,5.5vw,3.75rem)] font-bold leading-[1.08] tracking-tight">
              Aula particular com professor{' '}
              <mark className="whitespace-nowrap rounded-lg bg-yellow-400 px-2 text-indigo-950">verificado.</mark>
            </h1>
            <p className="text-lg leading-relaxed text-site-on-dark">
              Escolha a disciplina e a série, veja os horários livres e pague na reserva. Se o professor faltar, o dinheiro volta.
            </p>
          </div>
          <div className="min-w-0 flex-[1_1_24rem] rounded-[22px] bg-white p-5 sm:p-7">
            <h2 className="mb-4 font-display text-xl font-bold text-indigo-950">Encontre um professor</h2>
            <SearchForm subjects={SUBJECTS.map((s) => ({ id: s.id, name: s.name }))}
              grades={GRADE_LEVELS.map((g) => ({ id: g.id, name: g.name }))} />
          </div>
        </div>
      </section>

      <section className="px-5 py-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold tracking-tight">Como funciona</h2>
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-7">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-2.5">
                <span aria-hidden="true" className="font-display text-5xl font-bold leading-none text-indigo-600">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="text-[15px] leading-relaxed text-site-muted">{s.text}</p>
              </li>
            ))}
          </ol>
          <ProtectedNote title="Sua aula protegida">
            <p><strong className="text-indigo-950">Pagamento na reserva,</strong> por PIX ou cartão. O valor só vai para o professor depois da aula.</p>
            <p><strong className="text-indigo-950">Se o professor faltar,</strong> o dinheiro volta inteiro, sem precisar pedir.</p>
            <p><strong className="text-indigo-950">Identidade, antecedentes e formação conferidos</strong> antes de o professor aparecer aqui.</p>
          </ProtectedNote>
        </div>
      </section>

      <section className="bg-violet-50 px-5 py-14">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5">
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl font-bold">É professor?</h2>
            <p className="text-site-muted">Você ensina. A gente cuida da agenda, da cobrança e da sala de aula.</p>
          </div>
          <Link href="/professores"
            className="inline-flex min-h-13 items-center rounded-2xl bg-indigo-600 px-6 font-semibold text-white hover:bg-indigo-700">
            Conheça a Reforce para professores
          </Link>
        </div>
      </section>
    </>
  );
}
