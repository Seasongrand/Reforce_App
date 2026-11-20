'use client';

/**
 * Menu do topo no celular ("Buscar professor" e "Seja professor"). O topo
 * continua montado entre as páginas, então o menu fecha sozinho a cada troca
 * de endereço.
 */
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const MENU_LINK = 'flex min-h-11 items-center rounded-xl px-3 text-indigo-950 hover:bg-violet-50';

export function MobileMenu() {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  return (
    <details ref={ref} className="relative sm:hidden">
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
  );
}
