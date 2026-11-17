/** Peças comuns dos formulários do site (lista de professores e aviso para alunos). */
export type Option = { value: string; label: string };

export const INPUT =
  'block min-h-12 w-full rounded-xl border border-site-field bg-white px-3.5 text-[15px] font-normal text-indigo-950 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/30 aria-[invalid=true]:border-red-600';
export const LABEL = 'flex flex-col gap-1.5 text-sm font-semibold';

/** Várias escolhas em "fichas" (caixas de seleção com o rótulo inteiro clicável). */
export function Chips({ name, legend, options }: { name: string; legend: string; options: Option[] }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-site-field px-4 text-sm has-checked:border-indigo-600 has-checked:bg-indigo-50"
          >
            <input type="checkbox" name={name} value={o.value} className="size-4 accent-indigo-600" /> {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Campo-armadilha para robôs: escondido de pessoas e de leitores de tela. */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>
        Site
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

export function FormAlert({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
      {message}
    </p>
  );
}

export function SuccessMark() {
  return (
    <span className="flex size-14 items-center justify-center rounded-2xl bg-green-100 text-green-800">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

/** Convite pelo WhatsApp (abre o app com o texto pronto). */
export function WhatsAppInvite({ text, label }: { text: string; label: string }) {
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-13 items-center rounded-2xl bg-green-700 px-5 font-semibold text-white hover:bg-green-800"
    >
      {label}
    </a>
  );
}
