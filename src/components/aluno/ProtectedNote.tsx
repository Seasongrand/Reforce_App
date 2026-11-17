/** Quadro lilás com o escudo: as garantias da aula, em linguagem simples. */
export function ProtectedNote({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-violet-50 p-4">
      <span className="flex-none text-green-800">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </span>
      <div className="space-y-2 text-sm leading-relaxed text-[#3b3870]">
        {title && <p className="font-display text-lg font-bold text-indigo-950">{title}</p>}
        {children}
      </div>
    </div>
  );
}
