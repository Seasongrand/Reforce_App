'use client';

/**
 * Menu da área do professor: lateral no computador, faixa rolável no celular.
 * O item da página atual fica marcado (aria-current) e destacado.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type PanelIcon = 'home' | 'user' | 'tag' | 'calendar' | 'video' | 'shield' | 'wallet';
export interface PanelNavItem {
  href: string;
  label: string;
  icon: PanelIcon;
}

const PATHS: Record<PanelIcon, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
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
};

function isCurrent(pathname: string, href: string, rootHref: string): boolean {
  return href === rootHref ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function PanelNav({ items, label }: { items: PanelNavItem[]; label: string }) {
  const pathname = usePathname();
  const root = items[0]!.href;
  return (
    <nav aria-label={label} className="min-w-0">
      <ul className="-mx-5 flex gap-1 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0">
        {items.map((item) => {
          const current = isCurrent(pathname, item.href, root);
          return (
            <li key={item.href} className="flex-none">
              <Link
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-3 whitespace-nowrap rounded-xl px-3 text-[15px] font-semibold ${
                  current ? 'bg-indigo-100 text-indigo-950' : 'text-indigo-700 hover:bg-white'
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
                  {PATHS[item.icon]}
                </svg>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
