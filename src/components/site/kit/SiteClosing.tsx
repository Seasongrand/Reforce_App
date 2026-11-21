/**
 * Última tela do site (footer.closing, footer-dark com close-type): o
 * fechamento com a ação principal e, embaixo, os links e a linha legal com
 * o crédito das fotografias.
 */
import { Arrow, type NavLink } from './SiteNav';

export function SiteClosing({
  title, lead, action, columns, about = 'Agenda, cobrança e sala de aula para professores particulares.',
}: {
  title: string;
  lead: string;
  action: NavLink;
  columns: { title: string; links: NavLink[] }[];
  /** a frase sob a marca no rodapé, de acordo com quem lê a página */
  about?: string;
}) {
  return (
    <footer className="footer closing footer--dark ground-inverse" id="contato" aria-labelledby="close-h">
      <div className="wrap">
        <div className="closing__cta close--type">
          <div className="section-head">
            <h2 id="close-h">{title}</h2>
            <p>{lead}</p>
          </div>
          <a className="btn btn--primary btn--xl btn--wide" href={action.href}>
            {action.label}
            <Arrow />
          </a>
        </div>
        <div className="closing__links">
          <div className="grid">
            <div className="span-6 stack-4">
              <a className="nav__logo" href="/">
                <span className="mark" data-mark="arc" aria-hidden="true" />
                Reforce
              </a>
              <p className="footer__lede">{about}</p>
            </div>
            {columns.map((c, i) => (
              <div className={`span-3 footer__col${i === 0 ? ' start-7' : ''}`} key={c.title}>
                <h3>{c.title}</h3>
                <ul>
                  {c.links.map((l) => (
                    <li key={l.href}><a href={l.href}>{l.label}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="footer__legal">
            <span>© {new Date().getFullYear()} Reforce &nbsp; <a href="/privacidade">Privacidade</a></span>
            <a className="credits" href="/assets/creditos.html">Fotografias via Wikimedia Commons</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
