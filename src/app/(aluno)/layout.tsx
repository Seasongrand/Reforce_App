import type { Metadata } from 'next';
import { Schibsted_Grotesk } from 'next/font/google';
import { AppHtml, appMetadata } from '@/components/root/AppHtml';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';

export const metadata: Metadata = appMetadata();

// a fonte do site público (skill de design), só nas telas do aluno
const schibsted = Schibsted_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-schibsted' });
const FONT = { '--app-text': 'var(--font-schibsted)', '--app-display': 'var(--font-schibsted)' } as React.CSSProperties;


/**
 * Telas do aluno (perfil do professor, reserva, pagamento, confirmação e aula),
 * no visual do site público (skill de design, etapa 2). Feitas para o celular: coluna única, com espaço embaixo
 * para a barra fixa do perfil. A página que marca `data-wide` (o perfil do
 * professor) ganha a largura do computador para as duas colunas.
 */
export default function AlunoLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppHtml>
      <div className={`${schibsted.variable} flex min-h-screen flex-col bg-[#fbfaff] font-site text-indigo-950`} style={FONT}>
        <SiteHeader />
        <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-28 pt-6 lg:has-[[data-wide]]:max-w-6xl lg:has-[[data-wide]]:pb-16">{children}</main>
        <SiteFooter />
      </div>
    </AppHtml>
  );
}
