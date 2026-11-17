import { config } from '@/config';
import { StudentHome } from '@/components/aluno/StudentHome';
import { WaitlistLanding } from '@/components/site/WaitlistLanding';

export const dynamic = 'force-dynamic';

/**
 * Página inicial: no modo lista de espera, a página dos professores; com o
 * marketplace aberto, a vitrine de busca para o aluno (a página dos
 * professores fica em /professores).
 */
export default function Home() {
  return config().siteMode === 'lista_de_espera' ? <WaitlistLanding /> : <StudentHome />;
}
