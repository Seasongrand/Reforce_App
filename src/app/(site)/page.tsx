import { config } from '@/config';
import { StudentHome } from '@/components/site/StudentHome';
import { WaitlistLanding } from '@/components/site/WaitlistLanding';
import { currentSubject } from '@/server/session';

export const dynamic = 'force-dynamic';

/**
 * Página inicial: no modo lista de espera, a página dos professores; com o
 * marketplace aberto, a vitrine de busca para as famílias (a página dos
 * professores fica em /professores).
 */
export default async function Home() {
  if (config().siteMode === 'lista_de_espera') return <WaitlistLanding />;
  return <StudentHome signedIn={(await currentSubject('guardian')) !== null} />;
}
