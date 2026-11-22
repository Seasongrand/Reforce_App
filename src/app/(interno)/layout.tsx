import type { Metadata } from 'next';
import { AppHtml, appMetadata } from '@/components/root/AppHtml';

export const metadata: Metadata = appMetadata();

/** Painel da equipe: fundo e fonte do site, como a área do professor (o painel e o login têm o próprio invólucro). */
export default function InternoGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppHtml>
      <div className="min-h-screen bg-[#fbfaff] font-site text-indigo-950">{children}</div>
    </AppHtml>
  );
}
