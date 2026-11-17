import Link from 'next/link';
import { config } from '@/config';
import { currentSubject } from '@/server/session';

const LINK = 'inline-flex min-h-11 items-center rounded-xl px-3 hover:bg-indigo-900';
const ENTER = 'inline-flex min-h-11 items-center rounded-xl border border-indigo-400 px-4 text-white hover:bg-indigo-900';
const CTA = 'inline-flex min-h-11 items-center rounded-xl bg-yellow-400 px-4 text-indigo-950 hover:bg-yellow-300';

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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Link href="/" className="font-display text-2xl font-bold text-white">
          Reforce
        </Link>
        <nav aria-label="Principal" className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
          {open ? (
            <>
              <Link href="/buscar" className={LINK}>Buscar professor</Link>
              <Link href={signedIn ? '/conta' : '/conta/entrar'} className={ENTER}>{signedIn ? 'Minha conta' : 'Entrar'}</Link>
              <Link href="/professores" className={CTA}>Seja professor</Link>
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
