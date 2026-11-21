import type { Metadata } from 'next';
import { AppHtml, appMetadata } from '@/components/root/AppHtml';

export const metadata: Metadata = { ...appMetadata(), title: 'Equipe · Reforce', robots: { index: false, follow: false } };

/** Área da equipe: sem o topo público (botões "Entrar" e "Quero dar aula"). */
export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppHtml>
      <div className="min-h-screen bg-violet-50/50 font-site text-indigo-950">
        <header className="bg-indigo-950 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
            <span className="font-display text-2xl font-bold">Reforce</span>
            <span className="text-sm font-medium text-site-on-dark">Área da equipe</span>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
      </div>
    </AppHtml>
  );
}
