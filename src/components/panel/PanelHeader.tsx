import { ArcMark } from '@/components/site/SiteHeader';

/**
 * Topo dos painéis (professor, Minha conta e equipe) no visual do site
 * público (skill de design, etapa 3): barra branca com a marca e o nome da
 * área, o nome de quem entrou e "Sair".
 */
export function PanelHeader({
  home, area, name, nameTestId, logout, nameOnPhone = false,
}: {
  home: string;
  area: string;
  name?: string | null;
  nameTestId?: string;
  logout: () => Promise<void>;
  nameOnPhone?: boolean;
}) {
  return (
    <header className="print:hidden border-b border-indigo-950/10 bg-[#fbfaff]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 lg:h-[72px]">
        <a href={home} className="flex min-w-0 items-center gap-2.5 text-indigo-950">
          <ArcMark className="size-5 flex-none text-indigo-600" />
          <span className="font-display text-xl tracking-tight">Reforce</span>
          <span className="hidden truncate text-sm text-site-muted sm:inline">{area}</span>
        </a>
        <div className="flex min-w-0 items-center gap-3">
          {name && (
            <span className={`${nameOnPhone ? '' : 'hidden sm:inline'} truncate text-sm font-medium text-site-muted`} data-testid={nameTestId}>
              {name}
            </span>
          )}
          <form action={logout}>
            <button className="inline-flex h-11 items-center rounded-lg border border-indigo-950/20 bg-white px-4 text-sm font-medium text-indigo-950 transition hover:-translate-y-px hover:bg-violet-50">
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
