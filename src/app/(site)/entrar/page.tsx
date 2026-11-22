import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SiteClosing } from '@/components/site/kit/SiteClosing';
import { SiteNav } from '@/components/site/kit/SiteNav';
import { StudentWaitlistForm } from '@/components/site/StudentWaitlistForm';
import { config } from '@/config';
import { STAGES, WAITLIST_SUBJECTS } from '@/domain/waitlist';
import { joinStudentWaitlistAction } from '../actions';

export const dynamic = 'force-dynamic';

const title = 'Entrar · Reforce';
const description =
  'A Reforce abre em breve para alunos: aulas particulares com professores verificados e pagamento protegido. Deixe seu e-mail e avisamos.';
export const metadata: Metadata = { title, description, openGraph: { title, description } };

const PROMISES = [
  { title: 'Professores verificados', text: 'Identidade, antecedentes criminais e formação conferidos.' },
  { title: 'Pagamento protegido', text: 'O valor só vai para o professor depois da aula. Se ele faltar, o dinheiro volta.' },
  { title: 'Online ou presencial', text: 'Na sala da Reforce, direto no navegador, ou na sua casa.' },
];

/**
 * Botão "Entrar" do topo. Enquanto a plataforma não abre, o aluno pede aviso
 * da abertura; com o marketplace aberto, vai para o login de "Minha conta".
 * No visual da skill de design: o topo com a foto de uma aula e, logo
 * abaixo, o pedido de aviso.
 */
export default function StudentEntryPage() {
  const cfg = config();
  if (cfg.siteMode === 'completo') redirect('/conta/entrar');
  return (
    <>
      <SiteNav links={[{ href: '/professores', label: 'Professores' }]} primary={{ href: '#aviso', label: 'Pedir aviso' }} />
      <main id="top">
        <section className="hero hero--split entrar" data-enter aria-labelledby="hero-h">
          <div className="wrap">
            <div className="hero-text grid hero__grid">
              <div className="hero__text span-5">
                <p className="hero__kicker"><span className="dot" aria-hidden="true" />Para alunos e responsáveis</p>
                <h1 id="hero-h">A Reforce abre em breve para alunos</h1>
                <p className="hero__lead">
                  Estamos selecionando os primeiros professores. Deixe seu e-mail e avisamos quando der para reservar aulas na sua cidade.
                </p>
                <div className="btn-row"><a className="btn btn--primary" href="#aviso">Pedir aviso</a></div>
              </div>
              <div className="hero__media span-6 start-7">
                {/* stand-in do Wikimedia Commons até a Reforce ter fotos das próprias aulas */}
                <img
                  src="/assets/img/photo-f195684000-1280.webp"
                  srcSet="/assets/img/photo-f195684000-960.webp 960w, /assets/img/photo-f195684000-1280.webp 1280w, /assets/img/photo-f195684000-1920.webp 1920w"
                  sizes="(min-width: 1024px) 70vw, 100vw"
                  alt="Pessoa sentada escreve num caderno apoiado no colo"
                  fetchPriority="high"
                  data-source="stand-in"
                  data-subject="estudo com caderno"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="section lista" id="aviso" data-screen="free" aria-labelledby="aviso-h">
          <div className="wrap">
            <div className="grid grid--top">
              <div className="span-5 lista__text">
                <div className="section-head">
                  <h2 id="aviso-h">Aviso da abertura por e-mail</h2>
                  <p>Um e-mail quando a Reforce abrir na sua cidade. Sem custo e sem compromisso.</p>
                </div>
                  <ul className="checks entrar__promises">
                  {PROMISES.map((p) => (
                    <li key={p.title}><span><b>{p.title}.</b> {p.text}</span></li>
                  ))}
                  </ul>
              </div>
              <div className="span-6 start-7 lista__card">
                <StudentWaitlistForm
                  action={joinStudentWaitlistAction}
                  subjects={WAITLIST_SUBJECTS.map((s) => ({ value: String(s.id), label: s.name }))}
                  stages={Object.entries(STAGES).map(([value, label]) => ({ value, label }))}
                  teachersUrl={`${cfg.appBaseUrl}/professores`}
                />
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteClosing
        title="É professor? Entre na lista de espera"
        lead="Os primeiros professores verificados abrem a Reforce na sua cidade."
        action={{ href: '/professores#lista', label: 'Quero dar aula' }}
        about="Aulas particulares com professores verificados, do 6º ano ao pré-vestibular."
        columns={[
          { title: 'Professores', links: [{ href: '/professores', label: 'Professores' }] },
          { title: 'Reforce', links: [{ href: '/privacidade', label: 'Privacidade' }] },
        ]}
      />
    </>
  );
}
