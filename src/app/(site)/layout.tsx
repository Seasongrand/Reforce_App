import type { Metadata } from 'next';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';

const title = 'Reforce · Lista de espera de professores';
const description =
  'Você ensina. A gente cuida do resto. Página própria, agenda, pagamento por PIX ou cartão e sala de aula online. Entre na lista de espera dos primeiros professores.';

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, siteName: 'Reforce', locale: 'pt_BR', type: 'website' },
};

/** Páginas públicas do site (lista de espera e privacidade), com o visual da direção C. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white font-site text-indigo-950">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
