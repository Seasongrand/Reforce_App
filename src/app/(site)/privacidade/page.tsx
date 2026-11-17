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
    <article className="mx-auto max-w-3xl space-y-4 px-5 py-12 leading-relaxed text-site-muted">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-600">← Início</Link>
      <h1 className="font-display text-3xl font-bold tracking-tight text-indigo-950">Política de privacidade da lista de espera</h1>
      <p>
        Esta página explica como tratamos os dados de quem entra na lista de espera de professores da Reforce. Ela será
        substituída pela política completa quando a plataforma abrir.
      </p>
      <h2 className="pt-2 font-display text-xl font-bold text-indigo-950">Que dados coletamos</h2>
      <p>
        Nome, e-mail, WhatsApp (se você informar), cidade e UF, disciplinas, etapas e modalidades em que dá aula, sua
        formação, o currículo (se você enviar) e a mensagem opcional que você escrever, além da data da inscrição e da sua autorização de contato.
      </p>
      <h2 className="pt-2 font-display text-xl font-bold text-indigo-950">Para que usamos</h2>
      <p>
        Só para entrar em contato sobre a seleção de professores e o lançamento da plataforma, e para planejar em quais
        cidades e disciplinas começar. Não vendemos nem compartilhamos esses dados com terceiros para publicidade.
      </p>
      <h2 className="pt-2 font-display text-xl font-bold text-indigo-950">Por quanto tempo</h2>
      <p>Até o fim da seleção de professores ou até você pedir a exclusão, o que vier primeiro.</p>
      <h2 className="pt-2 font-display text-xl font-bold text-indigo-950">Seus direitos</h2>
      <p>
        Você pode pedir acesso, correção ou exclusão dos seus dados, ou retirar a autorização de contato, a qualquer
        momento, pelo e-mail <a className="text-indigo-600 underline" href={`mailto:${contact}`}>{contact}</a>.
      </p>
    </article>
  );
}
