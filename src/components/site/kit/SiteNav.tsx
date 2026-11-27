/**
 * Topo do site público no sistema do kit (nav-centre, marca arc): barra fixa
 * e opaca, palavras no meio, "Entrar" e o botão da ação principal à direita.
 * No celular, o system.js do kit transforma a barra numa folha de tela cheia.
 * Links são <a> comuns: cada página do site chega por um carregamento novo,
 * e os scripts do kit rodam de novo nela.
 */
export type NavLink = { href: string; label: string };

export function SiteNav({ links, secondary, primary }: { links: NavLink[]; secondary?: NavLink; primary?: NavLink }) {
  return (
    <header className="nav nav--centre">
      <div className="wrap nav__bar">
        <a className="skip-link" href="#top">Ir para o conteúdo</a>
        <a className="nav__logo" href="/">
          <span className="mark" data-mark="balao" aria-hidden="true" />
          Reforce
        </a>
        <nav className="nav__links" aria-label="Principal">
          {links.map((l) => (
            <div className="nav__item" key={l.href}>
              <a className="nav__link" href={l.href}>{l.label}</a>
            </div>
          ))}
        </nav>
        <div className="nav__actions">
          {secondary && <a className="nav__link" href={secondary.href}>{secondary.label}</a>}
          {primary && <a className="btn btn--primary" href={primary.href}>{primary.label}</a>}
        </div>
        <button className="nav__toggle" type="button" aria-expanded="false" aria-label="Menu">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 5h14M2 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      </div>
    </header>
  );
}

/** A seta desenhada do botão principal (system.md, Radius and buttons). */
export function Arrow() {
  return (
    <svg className="m-arrow" viewBox="0 0 12 12" aria-hidden="true">
      <path className="m-arrow__stem" d="M1 6h8" />
      <path className="m-arrow__head" d="M4.5 2.5 8 6l-3.5 3.5" />
    </svg>
  );
}
