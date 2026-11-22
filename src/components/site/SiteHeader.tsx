import Link from 'next/link';
import { config } from '@/config';
import { currentSubject } from '@/server/session';
import { MobileMenu } from './MobileMenu';

/** A marca da Reforce (o arco sorteado pela skill de design), a mesma do site público. */
export function ArcMark({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="currentColor" d="M2.5 21.5V12a9.5 9.5 0 0 1 19 0v9.5h-6V12a3.5 3.5 0 0 0-7 0v9.5z" />
    </svg>
  );
}

const WORD = 'relative inline-flex h-full items-center px-3 text-[15px] font-medium text-indigo-950 after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:origin-left after:scale-x-0 after:bg-current after:transition-transform hover:after:scale-x-100';
export const BUTTON_PRIMARY =
  'inline-flex h-11 items-center justify-center whitespace-nowrap rounded-lg bg-indigo-600 px-3.5 text-[15px] sm:px-5 font-medium text-white transition hover:-translate-y-px hover:bg-indigo-700 active:translate-y-0';

/**
 * Topo das telas do aluno (perfil, reserva, pagamento, busca), no visual do
 * site público (skill de design, etapa 2): barra branca fixa com a marca, as
 * palavras no meio, "Entrar" (ou "Minha conta") e o botão "Buscar professor".
 * No celular e no tablet, as palavras e "Entrar" vão para o Menu. No modo
 * lista de espera (só a equipe chega aqui), "Entrar" leva ao pedido de aviso.
 */
export async function SiteHeader() {
  const open = config().siteMode === 'completo';
  const signedIn = open && (await currentSubject('guardian')) !== null;
  const words = [
    { href: '/buscar', label: 'Busca' },
    { href: '/#como', label: 'Etapas' },
    { href: '/professores', label: 'Professores' },
  ];
  const account = open
    ? { href: signedIn ? '/conta' : '/conta/entrar', label: signedIn ? 'Minha conta' : 'Entrar' }
    : { href: '/entrar', label: 'Entrar' };
  return (
    <header className="sticky top-0 z-20 border-b border-indigo-950/10 bg-[#fbfaff]">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-5 sm:gap-3 lg:h-[72px] lg:px-8">
        <a href="/" className="inline-flex items-center gap-2 font-display text-xl tracking-tight text-indigo-950">
          <ArcMark className="size-5 text-indigo-600" />
          Reforce
        </a>
        <nav aria-label="Principal" className="hidden h-full flex-1 items-center justify-center lg:flex">
          {words.map((w) => <a key={w.href} href={w.href} className={WORD}>{w.label}</a>)}
        </nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <a href={account.href} className={`${WORD.replace('inline-flex ', '')} hidden h-11 lg:inline-flex`}>{account.label}</a>
          <a href="/buscar" className={BUTTON_PRIMARY}>Buscar professor</a>
          <MobileMenu links={[...words, account]} />
        </div>
      </div>
    </header>
  );
}
