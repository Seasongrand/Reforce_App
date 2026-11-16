import type { Metadata } from 'next';
import Link from 'next/link';
import { config } from '@/config';

export const metadata: Metadata = { title: 'Política de privacidade · Reforce' };
export const dynamic = 'force-dynamic';

/**
 * Versão provisória e factual, só para a lista de espera. O texto definitivo
 * depende de revisão jurídica (docs/pendencias.md).
 */
export default function PrivacyPage() {
  const contact = config().contactEmail;
  return (
    <article className="space-y-4 text-slate-800">
      <Link href="/" className="text-sm text-brand">← Início</Link>
      <h1 className="text-2xl font-semibold">Política de privacidade da lista de espera</h1>
      <p>
        Esta página explica como tratamos os dados de quem entra na lista de espera de professores da Reforce. Ela será
        substituída pela política completa quando a plataforma abrir.
      </p>
      <h2 className="text-lg font-medium">Que dados coletamos</h2>
      <p>
        Nome, e-mail, WhatsApp (se você informar), cidade e UF, disciplinas, etapas e modalidades em que dá aula, sua
        formação e a mensagem opcional que você escrever, além da data da inscrição e da sua autorização de contato.
      </p>
      <h2 className="text-lg font-medium">Para que usamos</h2>
      <p>
        Só para entrar em contato sobre a seleção de professores e o lançamento da plataforma, e para planejar em quais
        cidades e disciplinas começar. Não vendemos nem compartilhamos esses dados com terceiros para publicidade.
      </p>
      <h2 className="text-lg font-medium">Por quanto tempo</h2>
      <p>Até o fim da seleção de professores ou até você pedir a exclusão, o que vier primeiro.</p>
      <h2 className="text-lg font-medium">Seus direitos</h2>
      <p>
        Você pode pedir acesso, correção ou exclusão dos seus dados, ou retirar a autorização de contato, a qualquer
        momento, pelo e-mail <a className="text-brand underline" href={`mailto:${contact}`}>{contact}</a>.
      </p>
    </article>
  );
}
