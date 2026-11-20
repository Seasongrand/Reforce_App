import Link from 'next/link';
import { config } from '@/config';
import { currentSubject } from '@/server/session';

const ENTER = 'inline-flex min-h-11 items-center rounded-xl border border-indigo-400 px-4 text-white hover:bg-indigo-900';
const CTA = 'inline-flex min-h-11 items-center rounded-xl bg-yellow-400 px-4 text-indigo-950 hover:bg-yellow-300';
// no celular, "Buscar professor" e "Seja professor" vão para o menu: o topo cabe em uma linha
const WIDE_LINK = 'hidden min-h-11 items-center rounded-xl px-3 hover:bg-indigo-900 sm:inline-flex';
const WIDE_CTA = 'hidden min-h-11 items-center rounded-xl bg-yellow-400 px-4 text-indigo-950 hover:bg-yellow-300 sm:inline-flex';
const MENU_LINK = 'flex min-h-11 items-center rounded-xl px-3 text-indigo-950 hover:bg-violet-50';

/**
 * Topo do site, sempre com o botão "Entrar" do aluno. No modo lista de espera,
 * ele leva ao pedido de aviso da abertura (/entrar), ao lado de "Quero dar
 * aula" (nas páginas para professores). Com o marketplace aberto: "Buscar
 * professor", "Entrar" (ou "Minha conta", com o responsável já conectado) e
 * "Seja professor".
 */
export async function SiteHeader({ cta = true }: { cta?: boolean }) {
  const open = config().siteMode === 'completo';
  const signedIn = open && (await currentSubject('guardian')) !== null;
  return (
    <header className="bg-indigo-950 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-4">
        <Link href="/" className="font-display text-2xl font-bold text-white">
          Reforce
        </Link>
        <nav aria-label="Principal" className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
          {open ? (
            <>
              <Link href="/buscar" className={WIDE_LINK}>Buscar professor</Link>
              <Link href={signedIn ? '/conta' : '/conta/entrar'} className={ENTER}>{signedIn ? 'Minha conta' : 'Entrar'}</Link>
              <Link href="/professores" className={WIDE_CTA}>Seja professor</Link>
              <details className="relative sm:hidden">
                <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-3 hover:bg-indigo-900 [&::-webkit-details-marker]:hidden">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
                    <path d="M4 7h16M4 12h16M4 17h16" />
                  </svg>
                  Menu
                </summary>
                <div className="absolute right-0 top-full z-30 mt-2 w-56 space-y-1 rounded-2xl border border-site-line bg-white p-2 shadow-lg">
                  <Link href="/buscar" className={MENU_LINK}>Buscar professor</Link>
                  <Link href="/professores" className={MENU_LINK}>Seja professor</Link>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link href="/entrar" className={ENTER}>Entrar</Link>
              {cta && <Link href="/#lista" className={CTA}>Quero dar aula</Link>}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
