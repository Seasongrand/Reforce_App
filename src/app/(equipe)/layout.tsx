import type { Metadata } from 'next';
import { AppHtml, appMetadata } from '@/components/root/AppHtml';
import { ArcMark } from '@/components/site/SiteHeader';

export const metadata: Metadata = { ...appMetadata(), title: 'Equipe · Reforce', robots: { index: false, follow: false } };

/** Área da equipe: sem o topo público (botões "Entrar" e "Quero dar aula"). */
export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppHtml>
      <div className="min-h-screen bg-[#fbfaff] font-site text-indigo-950">
        <header className="border-b border-indigo-950/10 bg-[#fbfaff]">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 lg:h-[72px]">
            <span className="flex items-center gap-2.5">
              <ArcMark className="size-5 text-indigo-600" />
              <span className="font-display text-xl tracking-tight">Reforce</span>
            </span>
            <span className="text-sm text-site-muted">Área da equipe</span>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
      </div>
    </AppHtml>
  );
}
