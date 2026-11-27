import { BrandMark } from './SiteHeader';

/** Rodapé das telas do aluno, no visual do rodapé escuro do site público. */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-indigo-950 text-[#fbfaff]">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-16 lg:px-8">
        <div className="space-y-3">
          <a href="/" className="inline-flex items-center gap-2 font-display text-xl tracking-tight">
            <BrandMark className="size-6" />
            Reforce
          </a>
          <p className="max-w-xs text-lg leading-snug">Aulas particulares com professores verificados, do 6º ano ao pré-vestibular.</p>
        </div>
        <div className="space-y-2 text-[15px]">
          <h2 className="text-sm text-[#9e9fb8]">Famílias</h2>
          <a href="/buscar" className="flex min-h-11 items-center hover:underline">Busca</a>
          <a href="/#como" className="flex min-h-11 items-center hover:underline">Etapas</a>
        </div>
        <div className="space-y-2 text-[15px]">
          <h2 className="text-sm text-[#9e9fb8]">Reforce</h2>
          <a href="/professores" className="flex min-h-11 items-center hover:underline">Para professores</a>
          <a href="/termos" className="flex min-h-11 items-center hover:underline">Termos de uso</a>
          <a href="/privacidade" className="flex min-h-11 items-center hover:underline">Política de privacidade</a>
        </div>
      </div>
      <div className="mx-auto max-w-6xl border-t border-white/10 px-5 py-5 text-sm text-[#9e9fb8] lg:px-8">© {year} Reforce</div>
    </footer>
  );
}
