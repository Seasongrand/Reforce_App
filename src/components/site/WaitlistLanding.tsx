/**
 * Página para professores (lista de espera): em "/" no modo lista de espera e
 * sempre em "/professores". Feita com a skill design-taste-frontend (plano no
 * topo de src/app/(site)/layout.tsx):
 *
 *   hero      split: o texto à esquerda, a foto de uma aula à direita
 *   #como     pinned-chapters (o momento da página): três passos, uma janela da Reforce por passo (2 telas)
 *   #recursos dark-band: quatro cartões com o que a plataforma faz, cada um com a sua janela (2 telas)
 *   #perguntas FAQ aberta, em duas colunas (1 tela)
 *   #lista    o formulário ao lado de uma foto: uma tela, que cresce quando a pessoa passa para a etapa 2
 *   rodapé    close-type e footer-dark
 */
import { joinWaitlistAction } from '@/app/(site)/actions';
import { config } from '@/config';
import { EDUCATION, MODALITIES, STAGES, WAITLIST_SUBJECTS } from '@/domain/waitlist';
import { CLOSE, FAQ_TITLE, FEATURES, FEATURES_MUTED, FEATURES_TITLE, FORM_LEAD, FORM_TITLE, HERO, STEPS, STEPS_TITLE, faqWithCommission, withCommission } from './content';
import { SiteClosing } from './kit/SiteClosing';
import { Arrow, SiteNav } from './kit/SiteNav';
import { FeatureVisual, StepVisual } from './kit/Windows';
import { WaitlistForm } from './WaitlistForm';

const options = (o: Record<string, string>) => Object.entries(o).map(([value, label]) => ({ value, label }));

export function WaitlistLanding() {
  const cfg = config();
  const faq = faqWithCommission(cfg.commissionBps);
  const action = { href: '#lista', label: HERO.primary };
  return (
    <>
      <SiteNav
        links={[{ href: '#como', label: 'Etapas' }, { href: '#recursos', label: 'Recursos' }, { href: '#perguntas', label: 'Perguntas' }]}
        secondary={{ href: '/entrar', label: 'Entrar' }}
        primary={action}
      />
      <main id="top">
        <section className="hero hero--split" data-enter aria-labelledby="hero-h">
          <div className="wrap">
            <div className="hero-text grid hero__grid">
              <div className="hero__text span-5">
                <p className="hero__kicker"><span className="dot" aria-hidden="true" />{HERO.kicker}</p>
                <h1 id="hero-h">{HERO.title}</h1>
                <p className="hero__lead">{withCommission(HERO.lead, cfg.commissionBps)}</p>
                <div className="btn-row">
                  <a className="btn btn--primary" href="#lista">{HERO.primary}<Arrow /></a>
                  <a className="btn btn--secondary" href="#como">{HERO.secondary}</a>
                </div>
              </div>
              <div className="hero__media span-6 start-7">
                {/* stand-in do Wikimedia Commons até a Reforce ter fotos das próprias aulas */}
                <img
                  src="/assets/img/photo-f194440257-1280.webp"
                  srcSet="/assets/img/photo-f194440257-960.webp 960w, /assets/img/photo-f194440257-1280.webp 1280w, /assets/img/photo-f194440257-1920.webp 1920w"
                  sizes="(min-width: 1024px) 70vw, 100vw"
                  alt="Mão escreve com lápis num caderno aberto apoiado no colo"
                  style={{ ['--ly-pos' as string]: '55% 60%' }}
                  fetchPriority="high"
                  data-source="stand-in"
                  data-subject="estudo com caderno"
                />
                <div className="ly-float">
                  <div className="ly-float__row"><span className="ly-live">{HERO.float.day}</span><span>{HERO.float.time}</span></div>
                  <div className="ly-float__title">{HERO.float.title}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="como" style={{ ['--h' as string]: 2 }} data-moment="pinned-chapters" aria-labelledby="como-h">
          <div className="wrap mo-pc__grid">
            <div className="mo-pc__text">
              <h2 id="como-h">{STEPS_TITLE}</h2>
              <ol className="mo-pc__steps">
                {STEPS.map((s, i) => (
                  <li className="mo-pc__step" key={s.title}>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                    <figure className="mo-pc__visual"><StepVisual step={i} /></figure>
                  </li>
                ))}
              </ol>
            </div>
            <div className="mo-pc__visuals frame" />
          </div>
        </section>

        <section className="section g2 ground-inverse" id="recursos" aria-labelledby="recursos-h">
          <div className="wrap">
            <div className="group">
              <div className="section-head">
                <h2 id="recursos-h">{FEATURES_TITLE} <span className="muted">{FEATURES_MUTED}</span></h2>
              </div>
              <div className="grid">
                {FEATURES.slice(0, 2).map((f, i) => <Feature key={f.title} {...f} i={i} />)}
              </div>
            </div>
            <div className="grid">
              {FEATURES.slice(2).map((f, i) => <Feature key={f.title} {...f} i={i + 2} />)}
            </div>
          </div>
        </section>

        <section className="section" id="perguntas" aria-labelledby="perguntas-h">
          <div className="wrap">
            <div className="section-head"><h2 id="perguntas-h">{FAQ_TITLE}</h2></div>
            {/* todas as respostas abertas, sempre (system.md: FAQ sem acordeão) */}
            <div className="faq">
              {faq.map((f) => <details open key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
            </div>
          </div>
        </section>

        <section className="section lista" id="lista" data-screen="free" aria-labelledby="lista-h">
          <div className="wrap">
            <div className="grid grid--top">
              <div className="span-5 lista__text">
                <div className="section-head">
                  <h2 id="lista-h">{FORM_TITLE}</h2>
                  <p>{FORM_LEAD}</p>
                </div>
                <div className="frame frame--photo lista__photo">
                  <img
                    className="frame__img"
                    src="/assets/img/photo-f61802443-960.webp"
                    srcSet="/assets/img/photo-f61802443-500.webp 500w, /assets/img/photo-f61802443-960.webp 960w, /assets/img/photo-f61802443-1280.webp 1280w"
                    sizes="(min-width: 1024px) 60vw, 100vw"
                    alt="Lápis apontado e aparas sobre um caderno pautado em branco"
                    loading="lazy"
                    data-source="stand-in"
                    data-subject="caderno e lápis"
                  />
                </div>
              </div>
              <div className="span-6 start-7 lista__card">
                <WaitlistForm
                  action={joinWaitlistAction}
                  subjects={WAITLIST_SUBJECTS.map((s) => ({ value: String(s.id), label: s.name }))}
                  stages={options(STAGES)}
                  modalities={options(MODALITIES)}
                  education={options(EDUCATION)}
                  inviteUrl={cfg.appBaseUrl}
                />
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteClosing
        title={CLOSE.title}
        lead={CLOSE.lead}
        action={action}
        columns={[
          { title: 'Professores', links: [{ href: '#como', label: 'Etapas' }, { href: '#recursos', label: 'Recursos' }, { href: '#perguntas', label: 'Perguntas' }] },
          { title: 'Reforce', links: [{ href: '/entrar', label: 'Para alunos' }, { href: '/privacidade', label: 'Privacidade' }] },
        ]}
      />
    </>
  );
}

function Feature({ title, text, i }: { title: string; text: string; i: number }) {
  return (
    <article className="card card--row card--open span-6">
      <h3>{title}</h3>
      <p>{text}</p>
      <div className="panel"><FeatureVisual feature={i} /></div>
    </article>
  );
}
