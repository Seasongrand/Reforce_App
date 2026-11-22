import { PanelHeader } from '@/components/panel/PanelHeader';
import { PanelNav, type PanelNavItem } from '@/components/professor/PanelNav';
import { appDeps } from '@/server/app';
import { requireStaff } from '@/server/session';
import { logoutAction } from '../entrar/actions';

const ITEMS: PanelNavItem[] = [
  { href: '/interno', label: 'Início', icon: 'home' },
  { href: '/interno/verificacoes', label: 'Verificações', icon: 'shield' },
  { href: '/interno/aulas', label: 'Aulas', icon: 'video' },
  { href: '/interno/professores', label: 'Professores', icon: 'users' },
  { href: '/interno/reembolsos', label: 'Reembolsos', icon: 'undo' },
];
/** No celular, a barra de baixo tem estes; o resto fica em "Mais". */
const PRIMARY = ['/interno', '/interno/verificacoes', '/interno/aulas'];

/** Painel da equipe no molde da área do professor: topo com o nome e "Sair", menu lateral (no celular, barra embaixo). */
export default async function StaffPanelLayout({ children }: { children: React.ReactNode }) {
  const staffId = await requireStaff();
  const s = await appDeps().db.selectFrom('staff_users').select('name').where('id', '=', staffId).executeTakeFirst();
  return (
    <>
      <PanelHeader home="/interno" area="Equipe" name={s?.name} logout={logoutAction} />
      <div className="mx-auto grid max-w-6xl gap-6 px-5 pb-28 pt-6 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10 md:py-10">
        <aside className="min-w-0 max-md:contents md:sticky md:top-6 md:self-start">
          <PanelNav items={ITEMS} label="Painel da equipe" primary={PRIMARY} />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </>
  );
}
