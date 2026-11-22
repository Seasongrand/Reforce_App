import { PanelHeader } from '@/components/panel/PanelHeader';
import { PanelNav, type PanelNavItem } from '@/components/professor/PanelNav';
import { unreadTotal } from '@/domain/messages';
import { appDeps } from '@/server/app';
import { requireTeacher } from '@/server/session';
import { logoutAction } from '../entrar/actions';

const ITEMS: PanelNavItem[] = [
  { href: '/professor', label: 'Início', icon: 'home' },
  { href: '/professor/cadastro', label: 'Meu perfil', icon: 'user' },
  { href: '/professor/servicos', label: 'Serviços e preços', icon: 'tag' },
  { href: '/professor/agenda', label: 'Agenda', icon: 'calendar' },
  { href: '/professor/aulas', label: 'Aulas', icon: 'video' },
  { href: '/professor/mensagens', label: 'Mensagens', icon: 'chat' },
  { href: '/professor/verificacao', label: 'Documentos', icon: 'shield' },
  { href: '/professor/recebimento', label: 'Recebimento', icon: 'wallet' },
];
/** No celular, a barra de baixo tem estes; o resto fica em "Mais". */
const PRIMARY = ['/professor', '/professor/aulas', '/professor/mensagens', '/professor/agenda'];

/**
 * Painel do professor, no molde das plataformas de terapia (Telavita e
 * outras): topo com o nome e "Sair", menu lateral (no celular, uma barra
 * fixa embaixo) e o conteúdo da página.
 */
export default async function TeacherPanelLayout({ children }: { children: React.ReactNode }) {
  const teacherId = await requireTeacher();
  const { db } = appDeps();
  const t = await db.selectFrom('teachers').select('display_name').where('id', '=', teacherId).executeTakeFirstOrThrow();
  const unread = await unreadTotal(db, { kind: 'teacher', id: teacherId });
  const items = ITEMS.map((i) => (i.href === '/professor/mensagens' ? { ...i, badge: unread } : i));
  return (
    <>
      <PanelHeader home="/professor" area="Área do professor" name={t.display_name} nameTestId="painel-nome" logout={logoutAction} nameOnPhone />
      <div className="mx-auto grid max-w-6xl gap-6 px-5 pb-28 pt-6 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10 md:py-10">
        <aside className="min-w-0 max-md:contents md:sticky md:top-6 md:self-start">
          <PanelNav items={items} label="Área do professor" primary={PRIMARY} />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </>
  );
}
