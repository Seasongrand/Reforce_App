import type { Metadata } from 'next';
import Link from 'next/link';
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
    <article className="mx-auto max-w-3xl space-y-4 px-5 py-12 leading-relaxed text-site-muted">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-600">← Início</Link>
      <h1 className="font-display text-3xl font-bold tracking-tight text-indigo-950">Política de privacidade das listas de espera</h1>
      <p>
        Esta página explica como tratamos os dados de quem entra nas listas de espera da Reforce: a dos professores e a
        dos alunos que pedem aviso da abertura. Ela será substituída pela política completa quando a plataforma abrir.
      </p>
      <h2 className="pt-2 font-display text-xl font-bold text-indigo-950">Que dados coletamos</h2>
      <p>
        <strong className="text-indigo-950">Professores:</strong> nome, e-mail, WhatsApp (se você informar), cidade e UF,
        disciplinas, etapas e modalidades em que dá aula, sua formação, o currículo (se você enviar) e a mensagem opcional
        que você escrever, além da data da inscrição e da sua autorização de contato.
      </p>
      <p>
        <strong className="text-indigo-950">Alunos que pedem aviso:</strong> e-mail, cidade e UF, disciplinas e etapas de
        interesse, a data da inscrição e a sua autorização. A inscrição é feita por maiores de 18 anos: o responsável, ou o
        próprio aluno, se for maior de idade.
      </p>
      <h2 className="pt-2 font-display text-xl font-bold text-indigo-950">Para que usamos</h2>
      <p>
        Só para entrar em contato sobre a seleção de professores e a abertura da plataforma, e para planejar em quais
        cidades e disciplinas começar. Não vendemos nem compartilhamos esses dados com terceiros para publicidade.
      </p>
      <h2 className="pt-2 font-display text-xl font-bold text-indigo-950">Por quanto tempo</h2>
      <p>
        Professores: até o fim da seleção de professores. Alunos: até a abertura da plataforma na sua cidade. Ou até você
        pedir a exclusão, o que vier primeiro.
      </p>
      <h2 className="pt-2 font-display text-xl font-bold text-indigo-950">Seus direitos</h2>
      <p>
        Você pode pedir acesso, correção ou exclusão dos seus dados, ou retirar a autorização de contato, a qualquer
        momento, pelo e-mail <a className="text-indigo-600 underline" href={`mailto:${contact}`}>{contact}</a>.
      </p>
    </article>
  );
}
