import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';

/**
 * Telas do aluno (perfil do professor, reserva, pagamento, confirmação e aula),
 * no visual do site. Feitas para o celular: coluna única, com espaço embaixo
 * para a barra fixa do perfil. A página que marca `data-wide` (o perfil do
 * professor) ganha a largura do computador para as duas colunas.
 */
export default function AlunoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white font-site text-indigo-950">
      <SiteHeader cta={false} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-28 pt-6 lg:has-[[data-wide]]:max-w-6xl lg:has-[[data-wide]]:pb-16">{children}</main>
      <SiteFooter />
    </div>
  );
}
