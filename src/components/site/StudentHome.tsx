/**
 * Página inicial com o marketplace aberto: a vitrine para as famílias (a
 * página dos professores fica em /professores). Feita com a skill
 * design-taste-frontend; o sorteio desta página:
 *
 *   hero      photo: a foto de uma aula, as palavras numa caixa do lado calmo
 *   #busca    a busca ao lado de uma foto (1 tela)
 *   #aula     word-highlight (o momento da página): a garantia numa frase grande (1 tela)
 *   #como     três passos, cada um com a sua janela da Reforce (1 tela)
 *   rodapé    close-type e footer-dark
 */
import { GRADE_LEVELS, SUBJECTS } from '@/domain/catalog';
import { SearchForm } from '@/components/aluno/SearchForm';
import { SiteClosing } from './kit/SiteClosing';
import { Arrow, SiteNav } from './kit/SiteNav';
import { FeatureVisual } from './kit/Windows';

const STEPS = [
  { title: 'Escolha o professor', text: 'Perfis verificados, com foto, preço e os horários livres de verdade.', visual: 3 },
  { title: 'Reserve e pague', text: 'PIX ou cartão. O horário fica guardado enquanto você paga.', visual: 0 },
  { title: 'Faça a aula', text: 'Na sala da Reforce, no navegador, ou presencial, na sua casa ou no endereço do professor.', visual: 2 },
];

export function StudentHome({ signedIn }: { signedIn: boolean }) {
  const action = { href: '#busca', label: 'Buscar professor' };
  return (
    <>
      <SiteNav
        links={[{ href: '#busca', label: 'Busca' }, { href: '#como', label: 'Etapas' }, { href: '/professores', label: 'Professores' }]}
        secondary={signedIn ? { href: '/conta', label: 'Minha conta' } : { href: '/conta/entrar', label: 'Entrar' }}
        primary={action}
      />
      <main id="top">
        <section className="hero hero--photo" data-enter data-calm="left" aria-labelledby="hero-h">
          {/* stand-in do Wikimedia Commons até a Reforce ter fotos das próprias aulas */}
          <img
            className="hero__bg"
            src="/assets/img/photo-f106878796-1920.webp"
            srcSet="/assets/img/photo-f106878796-960.webp 960w, /assets/img/photo-f106878796-1280.webp 1280w, /assets/img/photo-f106878796-1920.webp 1920w"
            sizes="(max-width: 639px) 160vw, 100vw"
            alt="Caderno aberto em branco com um lápis, sobre uma mesa de madeira"
            style={{ ['--ly-pos' as string]: '75% 50%', ['--ly-pos-phone' as string]: '70% 50%' }}
            fetchPriority="high"
            data-source="stand-in"
            data-subject="caderno e lápis"
          />
          <div className="wrap">
            <div className="hero-text">
              <div className="hero__text">
                <h1 id="hero-h">Aula particular com professor verificado</h1>
                <p className="hero__lead">
                  Do 6º ano ao pré-vestibular, online ou presencial. Você paga na reserva e, se o professor faltar, o dinheiro volta.
                </p>
                <div className="btn-row">
                  <a className="btn btn--primary" href="#busca">Buscar professor<Arrow /></a>
                  <a className="btn btn--secondary" href="#como">Ver como funciona</a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="busca" aria-labelledby="busca-h">
          <div className="wrap">
            <div className="grid grid--top">
              <div className="span-5 lista__text">
                <div className="section-head">
                  <h2 id="busca-h">Professores por disciplina e série</h2>
                  <p>Escolha a matéria, a série e onde vai ser a aula. Aparecem só professores verificados com horário livre.</p>
                </div>
                <div className="frame frame--photo lista__photo lista__photo--short">
                  <img
                    className="frame__img"
                    src="/assets/img/photo-f117883894-960.webp"
                    srcSet="/assets/img/photo-f117883894-500.webp 500w, /assets/img/photo-f117883894-960.webp 960w, /assets/img/photo-f117883894-1280.webp 1280w"
                    sizes="(min-width: 1024px) 40vw, 100vw"
                    alt="Mão com caneta escreve num caderno de capa laranja"
                    loading="lazy"
                    data-source="stand-in"
                    data-subject="estudo com caderno"
                  />
                </div>
              </div>
              <div className="span-6 start-7 lista__card">
                <SearchForm look="site" subjects={SUBJECTS.map((s) => ({ id: s.id, name: s.name }))} grades={GRADE_LEVELS.map((g) => ({ id: g.id, name: g.name }))} />
              </div>
            </div>
          </div>
        </section>

        <section className="section statement" id="aula" data-moment="word-highlight" aria-label="Sua aula protegida">
          <div className="wrap">
            <p className="t-label">Sua aula protegida</p>
            <p className="mo-wh__text">
              Você paga na reserva e o valor só vai para o professor 2 horas depois da aula. Se ele faltar, o dinheiro volta inteiro, sem precisar pedir.
              Se algo der errado, você conta nesse prazo e a equipe confere antes de liberar. E cada professor tem <strong>identidade e formação</strong>
              conferidas; quem dá aula presencial, também a <strong>certidão de antecedentes</strong>.
            </p>
          </div>
        </section>

        <section className="section ground-surface familias-como" id="como" aria-labelledby="como-h">
          <div className="wrap">
            <div className="section-head"><h2 id="como-h">Da busca à aula, em três passos</h2></div>
            <div className="grid">
              {STEPS.map((s) => (
                <article className="card card--open span-4" key={s.title}>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                  <div className="panel"><FeatureVisual feature={s.visual} /></div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteClosing
        title="O professor da matéria que falta"
        lead="Busque por disciplina e série e veja os horários livres desta semana."
        action={action}
        about="Aulas particulares com professores verificados, do 6º ano ao pré-vestibular."
        columns={[
          { title: 'Famílias', links: [{ href: '#busca', label: 'Busca' }, { href: '#como', label: 'Etapas' }] },
          { title: 'Reforce', links: [{ href: '/professores', label: 'Professores' }, { href: '/privacidade', label: 'Privacidade' }] },
        ]}
      />
    </>
  );
}
