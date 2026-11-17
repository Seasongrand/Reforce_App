import Link from 'next/link';

/** Topo do site. O botão "Quero dar aula" aparece nas páginas para professores, não nas telas do aluno. */
export function SiteHeader({ cta = true }: { cta?: boolean }) {
  return (
    <header className="bg-indigo-950 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Link href="/" className="font-display text-2xl font-bold text-white">
          Reforce
        </Link>
        {cta && (
          <Link
            href="/#lista"
            className="inline-flex min-h-11 items-center rounded-xl bg-yellow-400 px-5 text-[15px] font-semibold text-indigo-950 hover:bg-yellow-300"
          >
            Quero dar aula
          </Link>
        )}
      </div>
    </header>
  );
}
