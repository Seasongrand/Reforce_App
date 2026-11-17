import Link from 'next/link';
import { config } from '@/config';

/**
 * Topo do site. No modo lista de espera, o botão "Quero dar aula" (nas
 * páginas para professores). Com o marketplace aberto, os links "Buscar
 * professor" e "Seja professor".
 */
export function SiteHeader({ cta = true }: { cta?: boolean }) {
  const open = config().siteMode === 'completo';
  return (
    <header className="bg-indigo-950 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Link href="/" className="font-display text-2xl font-bold text-white">
          Reforce
        </Link>
        {open ? (
          <nav aria-label="Principal" className="flex items-center gap-1 text-[15px] font-semibold">
            <Link href="/buscar" className="inline-flex min-h-11 items-center rounded-xl px-3 hover:bg-indigo-900">Buscar professor</Link>
            <Link href="/professores" className="inline-flex min-h-11 items-center rounded-xl bg-yellow-400 px-4 text-indigo-950 hover:bg-yellow-300">
              Seja professor
            </Link>
          </nav>
        ) : cta && (
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
