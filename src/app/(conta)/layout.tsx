import type { Metadata } from 'next';
import { AppHtml, appMetadata } from '@/components/root/AppHtml';

export const metadata: Metadata = appMetadata();

/** Minha conta (família): fundo e fonte do site, como a área do professor. Entrar e Criar conta ficam nas telas do site. */
export default function ContaGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppHtml>
      <div className="min-h-screen bg-violet-50/60 font-site text-indigo-950">{children}</div>
    </AppHtml>
  );
}
