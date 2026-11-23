'use client';

/**
 * Menu dos painéis (professor e equipe): lateral no computador; no celular, barra
 * fixa embaixo com os destinos de `primary` e "Mais" (o resto).
 * O item da página atual fica marcado (aria-current) e destacado.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type PanelIcon = 'home' | 'user' | 'users' | 'tag' | 'calendar' | 'video' | 'shield' | 'wallet' | 'undo' | 'chat' | 'flag';
export interface PanelNavItem {
  href: string;
  label: string;
  icon: PanelIcon;
  /** Quantos itens pedem atenção (mensagens não lidas); 0 ou ausente não mostra nada. */
  badge?: number;
}

const PATHS: Record<PanelIcon, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
    </>
  ),
  tag: (
    <>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  video: (
    <>
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="m16 10 6-3v10l-6-3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  wallet: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M16 15h2" />
    </>
  ),
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />,
  flag: <path d="M4 22V4m0 0s1.5-1 4-1 4.5 2 7 2 4-1 4-1v11s-1.5 1-4 1-4.5-2-7-2-4 1-4 1" />,
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>
  ),
};

function isCurrent(pathname: string, href: string, rootHref: string): boolean {
  return href === rootHref ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Número de não lidas: visível como selo e lido por inteiro pelo leitor de tela. */
function Badge({ n, onIcon = false }: { n?: number; onIcon?: boolean }) {
  if (!n) return null;
  const text = n > 99 ? '99+' : String(n);
  return (
    <>
      <span aria-hidden="true" className={`min-w-5 rounded-full bg-rose-600 px-1.5 text-center text-[11px] font-medium leading-5 text-white ${onIcon ? 'absolute -right-1 -top-1' : 'ml-auto'}`}>{text}</span>
      <span className="sr-only"> ({n === 1 ? '1 não lida' : `${n} não lidas`})</span>
    </>
  );
}

function Icon({ name }: { name: PanelIcon }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
      {PATHS[name]}
    </svg>
  );
}

/** `primary`: os destinos que ficam na barra de baixo do celular; o resto vai para "Mais" (sem resto, não há "Mais"). */
export function PanelNav({ items, label, primary: primaryHrefs }: { items: PanelNavItem[]; label: string; primary: string[] }) {
  const pathname = usePathname();
  const root = items[0]!.href;
  const [more, setMore] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => setMore(false), [pathname]);
  useEffect(() => {
    if (!more) return;
    const close = (e: MouseEvent) => { if (!sheet.current?.contains(e.target as Node)) setMore(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [more]);
  const primary = primaryHrefs.map((h) => items.find((i) => i.href === h)).filter((i): i is PanelNavItem => Boolean(i));
  const rest = items.filter((i) => !primaryHrefs.includes(i.href));
  const inRest = rest.some((i) => isCurrent(pathname, i.href, root));
  const tab = 'flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs font-medium';
  return (
    <>
      {/* computador: menu lateral */}
      <nav aria-label={label} className="hidden min-w-0 md:block">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const current = isCurrent(pathname, item.href, root);
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={current ? 'page' : undefined}
                  className={`flex min-h-11 items-center gap-3 whitespace-nowrap rounded-xl px-3 text-[15px] font-medium ${
                    current ? 'bg-indigo-100 text-indigo-950' : 'text-indigo-700 hover:bg-white'}`}>
                  <Icon name={item.icon} />
                  {item.label}
                  <Badge n={item.badge} />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* celular: barra fixa embaixo, com "Mais" para o resto */}
      <nav aria-label={label} ref={sheet}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-site-line bg-white pb-[env(safe-area-inset-bottom,0px)] md:hidden">
        {more && (
          <ul className="absolute inset-x-3 bottom-[calc(100%+8px)] space-y-1 rounded-[20px] border border-site-line bg-white p-2">
            {rest.map((item) => {
              const current = isCurrent(pathname, item.href, root);
              return (
                <li key={item.href}>
                  <Link href={item.href} aria-current={current ? 'page' : undefined}
                    className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-medium ${current ? 'bg-indigo-100 text-indigo-950' : 'text-indigo-700'}`}>
                    <Icon name={item.icon} />
                    {item.label}
                    <Badge n={item.badge} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${primary.length + (rest.length > 0 ? 1 : 0)}, minmax(0, 1fr))` }}>
          {primary.map((item) => {
            const current = isCurrent(pathname, item.href, root);
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={current ? 'page' : undefined}
                  className={`${tab} ${current ? 'text-indigo-950' : 'text-site-muted'}`}>
                  <span className={`relative flex h-7 w-12 items-center justify-center rounded-full ${current ? 'bg-indigo-100' : ''}`}>
                    <Icon name={item.icon} /><Badge n={item.badge} onIcon />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
          {rest.length > 0 && <li>
            <button type="button" aria-expanded={more} onClick={() => setMore((m) => !m)}
              className={`${tab} ${more || inRest ? 'text-indigo-950' : 'text-site-muted'}`}>
              <span className={`flex h-7 w-12 items-center justify-center rounded-full ${more || inRest ? 'bg-indigo-100' : ''}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </span>
              Mais
            </button>
          </li>}
        </ul>
      </nav>
    </>
  );
}
