'use client';

/**
 * Menu do topo no celular e no tablet: as palavras do topo e "Entrar" (ou
 * "Minha conta"). O topo continua montado entre as páginas, então o menu
 * fecha sozinho a cada troca de endereço.
 */
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  return (
    <details ref={ref} className="relative lg:hidden">
      <summary
        aria-label="Menu"
        className="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-lg border border-indigo-950/15 bg-white text-indigo-950 hover:bg-violet-50 [&::-webkit-details-marker]:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M2 5h14M2 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </summary>
      <nav aria-label="Menu" className="absolute right-0 top-full z-30 mt-2 w-60 rounded-xl border border-indigo-950/10 bg-white p-2">
        {links.map((l) => (
          <a key={l.href} href={l.href} className="flex min-h-12 items-center rounded-lg px-3 text-base text-indigo-950 hover:bg-violet-50">
            {l.label}
          </a>
        ))}
      </nav>
    </details>
  );
}
