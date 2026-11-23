'use client';

/** Abre a impressão do navegador (dá para salvar em PDF por ela). */
export function PrintButton({ label = 'Imprimir ou salvar em PDF', className }: { label?: string; className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className ?? 'inline-flex min-h-11 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 print:hidden'}>
      {label}
    </button>
  );
}
