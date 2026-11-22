import type { Metadata } from 'next';
import { AppHtml, appMetadata } from '@/components/root/AppHtml';

export const metadata: Metadata = appMetadata();

/** Área do professor: fundo e fonte do site (o painel e o login têm o próprio invólucro). */
export default function ProfessorGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppHtml>
      <div className="min-h-screen bg-[#fbfaff] font-site text-indigo-950">{children}</div>
    </AppHtml>
  );
}
