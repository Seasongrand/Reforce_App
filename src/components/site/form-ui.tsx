/**
 * Peças comuns dos formulários do site (lista de professores e aviso para
 * alunos), no sistema do kit: .field do system.css e o resto em
 * public/assets/site.css. Os formulários não usam a classe .form do kit, que
 * o system.js tomaria para si: quem envia é a ação do servidor.
 */
export type Option = { value: string; label: string };

/** Várias escolhas em "fichas" (caixas de seleção com o rótulo inteiro clicável). */
export function Chips({ name, legend, options }: { name: string; legend: string; options: Option[] }) {
  return (
    <fieldset className="chips">
      <legend>{legend}</legend>
      <div className="chips__list">
        {options.map((o) => (
          <label key={o.value} className="chip">
            <input type="checkbox" name={name} value={o.value} /> {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Campo-armadilha para robôs: escondido de pessoas e de leitores de tela. */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="honeypot">
      <label>
        Site
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

export function FormAlert({ message }: { message: string }) {
  return <p role="alert" className="form-alert">{message}</p>;
}

/** Convite pelo WhatsApp (abre o app com o texto pronto). */
export function WhatsAppInvite({ text, label }: { text: string; label: string }) {
  return (
    <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="btn btn--secondary">
      <img src="/assets/icons/brand/whatsapp.svg" alt="" width="20" height="20" />
      {label}
    </a>
  );
}
