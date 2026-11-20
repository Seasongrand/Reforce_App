import Link from 'next/link';
import { PanelNav, type PanelNavItem } from '@/components/professor/PanelNav';
import { appDeps } from '@/server/app';
import { requireGuardian } from '@/server/session';
import { logoutAction } from './actions';

const ITEMS: PanelNavItem[] = [
  { href: '/conta', label: 'Início', icon: 'home' },
  { href: '/conta/aulas', label: 'Aulas', icon: 'video' },
  { href: '/conta/alunos', label: 'Alunos', icon: 'users' },
  { href: '/conta/dados', label: 'Meus dados', icon: 'user' },
];
/** São só quatro: todos ficam na barra de baixo do celular, sem "Mais". */
const PRIMARY = ITEMS.map((i) => i.href);

/** Minha conta no molde da área do professor: topo com o nome e "Sair", menu lateral (no celular, barra embaixo). */
export default async function GuardianPanelLayout({ children }: { children: React.ReactNode }) {
  const guardianId = await requireGuardian();
  const g = await appDeps().db.selectFrom('guardians').select('name').where('id', '=', guardianId).executeTakeFirstOrThrow();
  return (
    <>
      <header className="bg-indigo-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
          <Link href="/" className="flex items-baseline gap-2.5">
            <span className="font-display text-2xl font-bold">Reforce</span>
            <span className="hidden text-sm font-medium text-site-on-dark sm:inline">Minha conta</span>
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden truncate text-sm font-semibold text-site-on-dark sm:inline">{g.name}</span>
            <form action={logoutAction}>
              <button className="inline-flex min-h-11 items-center rounded-xl border border-indigo-400 px-4 text-sm font-semibold text-white hover:bg-indigo-900">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-5 pb-28 pt-6 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10 md:py-10">
        <aside className="min-w-0 max-md:contents md:sticky md:top-6 md:self-start">
          <PanelNav items={ITEMS} label="Minha conta" primary={PRIMARY} />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </>
  );
}
