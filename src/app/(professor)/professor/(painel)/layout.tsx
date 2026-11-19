import Link from 'next/link';
import { PanelNav, type PanelNavItem } from '@/components/professor/PanelNav';
import { appDeps } from '@/server/app';
import { requireTeacher } from '@/server/session';
import { logoutAction } from '../entrar/actions';

const ITEMS: PanelNavItem[] = [
  { href: '/professor', label: 'Início', icon: 'home' },
  { href: '/professor/cadastro', label: 'Meu perfil', icon: 'user' },
  { href: '/professor/servicos', label: 'Serviços e preços', icon: 'tag' },
  { href: '/professor/agenda', label: 'Agenda', icon: 'calendar' },
  { href: '/professor/aulas', label: 'Aulas', icon: 'video' },
  { href: '/professor/verificacao', label: 'Documentos', icon: 'shield' },
  { href: '/professor/recebimento', label: 'Recebimento', icon: 'wallet' },
];

/**
 * Painel do professor, no molde das plataformas de terapia (Telavita e
 * outras): topo com o nome e "Sair", menu lateral (no celular, uma faixa
 * rolável acima do conteúdo) e o conteúdo da página.
 */
export default async function TeacherPanelLayout({ children }: { children: React.ReactNode }) {
  const teacherId = await requireTeacher();
  const t = await appDeps().db.selectFrom('teachers').select('display_name').where('id', '=', teacherId).executeTakeFirstOrThrow();
  return (
    <>
      <header className="bg-indigo-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
          <Link href="/professor" className="flex items-baseline gap-2.5">
            <span className="font-display text-2xl font-bold">Reforce</span>
            <span className="hidden text-sm font-medium text-site-on-dark sm:inline">Área do professor</span>
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <span className="truncate text-sm font-semibold text-site-on-dark" data-testid="painel-nome">{t.display_name}</span>
            <form action={logoutAction}>
              <button className="inline-flex min-h-11 items-center rounded-xl border border-indigo-400 px-4 text-sm font-semibold text-white hover:bg-indigo-900">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-6 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10 md:py-10">
        <aside className="min-w-0 md:sticky md:top-6 md:self-start">
          <PanelNav items={ITEMS} label="Área do professor" />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </>
  );
}
