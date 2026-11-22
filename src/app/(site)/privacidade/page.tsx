import type { Metadata } from 'next';
import { SiteClosing } from '@/components/site/kit/SiteClosing';
import { SiteNav } from '@/components/site/kit/SiteNav';
import { config } from '@/config';

export const metadata: Metadata = { title: 'Política de privacidade · Reforce' };
export const dynamic = 'force-dynamic';

/**
 * Versão provisória e factual, só para as listas de espera (professores e
 * alunos que pedem aviso da abertura). O texto definitivo
 * depende de revisão jurídica (docs/pendencias.md).
 */
export default function PrivacyPage() {
  const contact = config().contactEmail;
  return (
    <>
    <SiteNav links={[{ href: '/professores', label: 'Professores' }, { href: '/entrar', label: 'Alunos' }]} />
    <main id="top">
    <section className="section legal" style={{ ['--h' as string]: 2 }} aria-labelledby="legal-h">
    <div className="wrap">
    <article className="measure stack-4">
      <h1 id="legal-h" className="t-h2">Política de privacidade das listas de espera</h1>
      <p>
        Esta página explica como tratamos os dados de quem entra nas listas de espera da Reforce: a dos professores e a
        dos alunos que pedem aviso da abertura. Ela será substituída pela política completa quando a plataforma abrir.
      </p>
      <h2 className="t-h3">Que dados coletamos</h2>
      <p>
        <strong>Professores:</strong> nome, e-mail, WhatsApp (se você informar), cidade e UF,
        disciplinas, etapas e modalidades em que dá aula, sua formação, o currículo (se você enviar) e a mensagem opcional
        que você escrever, além da data da inscrição e da sua autorização de contato.
      </p>
      <p>
        <strong>Alunos que pedem aviso:</strong> e-mail, cidade e UF, disciplinas e etapas de
        interesse, a data da inscrição e a sua autorização. A inscrição é feita por maiores de 18 anos: o responsável, ou o
        próprio aluno, se for maior de idade.
      </p>
      <h2 className="t-h3">Para que usamos</h2>
      <p>
        Só para entrar em contato sobre a seleção de professores e a abertura da plataforma, e para planejar em quais
        cidades e disciplinas começar. Não vendemos nem compartilhamos esses dados com terceiros para publicidade.
      </p>
      <h2 className="t-h3">Por quanto tempo</h2>
      <p>
        Professores: até o fim da seleção de professores. Alunos: até a abertura da plataforma na sua cidade. Ou até você
        pedir a exclusão, o que vier primeiro.
      </p>
      <h2 className="t-h3">Seus direitos</h2>
      <p>
        Você pode pedir acesso, correção ou exclusão dos seus dados, ou retirar a autorização de contato, a qualquer
        momento, pelo <a className="link" href={`mailto:${contact}`}>e-mail da equipe</a>.
      </p>
    </article>
    </div>
    </section>
    </main>
    <SiteClosing
      title="Dúvidas sobre os seus dados"
      lead="Escreva para a equipe pedindo acesso, correção ou exclusão. Respondemos por e-mail."
      action={{ href: `mailto:${contact}`, label: 'Escrever para a equipe' }}
      columns={[
        { title: 'Professores', links: [{ href: '/professores', label: 'Professores' }] },
        { title: 'Alunos', links: [{ href: '/entrar', label: 'Alunos' }] },
      ]}
    />
    </>
  );
}
