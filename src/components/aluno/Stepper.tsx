const STEPS = ['Horário', 'Seus dados', 'Pagamento'] as const;

/** Passos da reserva: os anteriores aparecem com ✓, o atual em destaque. */
export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol aria-label="Etapas da reserva" className="grid grid-cols-3 gap-1.5 text-[13px] font-semibold">
      {STEPS.map((label, i) => {
        const n = i + 1;
        return (
          <li key={label} aria-current={n === current ? 'step' : undefined}
            className={`flex flex-col gap-1.5 ${n === current ? 'text-indigo-950' : 'text-site-muted'}`}>
            <span aria-hidden="true" className={`h-1.5 rounded-full ${n <= current ? 'bg-indigo-600' : 'bg-site-line'}`} />
            {n < current ? `✓ ${label}` : label}
          </li>
        );
      })}
    </ol>
  );
}
