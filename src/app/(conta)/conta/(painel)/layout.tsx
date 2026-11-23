import { PanelHeader } from '@/components/panel/PanelHeader';
import { PanelNav, type PanelNavItem } from '@/components/professor/PanelNav';
import { unreadTotal } from '@/domain/messages';
import { appDeps } from '@/server/app';
import { requireGuardian } from '@/server/session';
import { logoutAction } from './actions';

const ITEMS: PanelNavItem[] = [
  { href: '/conta', label: 'Início', icon: 'home' },
  { href: '/conta/aulas', label: 'Aulas', icon: 'video' },
  { href: '/conta/mensagens', label: 'Mensagens', icon: 'chat' },
  { href: '/conta/alunos', label: 'Alunos', icon: 'users' },
  { href: '/conta/dados', label: 'Meus dados', icon: 'user' },
];
/** São só cinco: todos ficam na barra de baixo do celular, sem "Mais". */
const PRIMARY = ITEMS.map((i) => i.href);

/** Minha conta no molde da área do professor: topo com o nome e "Sair", menu lateral (no celular, barra embaixo). */
export default async function GuardianPanelLayout({ children }: { children: React.ReactNode }) {
  const guardianId = await requireGuardian();
  const { db } = appDeps();
  const g = await db.selectFrom('guardians').select('name').where('id', '=', guardianId).executeTakeFirstOrThrow();
  const unread = await unreadTotal(db, { kind: 'guardian', id: guardianId });
  const items = ITEMS.map((i) => (i.href === '/conta/mensagens' ? { ...i, badge: unread } : i));
  return (
    <>
      <PanelHeader home="/" area="Minha conta" name={g.name} logout={logoutAction} />
      <div className="mx-auto grid max-w-6xl gap-6 px-5 pb-28 pt-6 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10 md:py-10">
        <aside className="min-w-0 print:!hidden max-md:contents md:sticky md:top-6 md:self-start">
          <PanelNav items={items} label="Minha conta" primary={PRIMARY} />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </>
  );
}
