import type { Metadata } from 'next';
import { LegalShell } from '@/components/site/LegalShell';
import { config } from '@/config';

export const metadata: Metadata = { title: 'Política de privacidade · Reforce' };
export const dynamic = 'force-dynamic';

/**
 * Política de privacidade (LGPD), escrita a partir do que o sistema guarda e
 * de para quem envia. Versão inicial sem revisão jurídica: docs/pendencias.md.
 * Quem passa a guardar um dado novo ou a usar outro fornecedor muda o texto aqui.
 */
export default function PrivacyPage() {
  const contact = config().contactEmail;
  const mail = <a href={`mailto:${contact}`}>{contact}</a>;
  return (
    <LegalShell title="Política de privacidade" updated="27 de novembro de 2026">
      <p>
        Esta política explica quais dados a Reforce guarda, para quê, com quem eles são compartilhados e como você pede
        acesso, correção ou exclusão. Ela segue a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018). A Reforce é a
        controladora dos dados. Para qualquer assunto sobre os seus dados, escreva para {mail}.
      </p>

      <h2 className="t-h3">1. Que dados guardamos</h2>
      <p>
        <strong>Responsável (conta da família):</strong> nome, e-mail, WhatsApp (se você quiser avisos por lá), o
        endereço da aula presencial, as aulas reservadas, os pagamentos, as mensagens com o professor, as contestações e
        as avaliações. O CPF pedido no pagamento vai direto para o Asaas, que o exige para emitir a cobrança; a Reforce
        não o guarda.
      </p>
      <p>
        <strong>Aluno:</strong> só o primeiro nome e a série. O aluno não tem conta, login nem e-mail na Reforce, e não
        envia mensagens.
      </p>
      <p>
        <strong>Professor:</strong> nome, e-mail, WhatsApp, foto, apresentação, disciplinas, formação, experiência,
        preços, agenda, aulas e repasses. Para a verificação, um documento com foto, uma selfie, o comprovante de
        formação e, para aula presencial, a certidão de antecedentes criminais. Esses arquivos ficam criptografados, fora
        do banco de dados, e só a equipe de verificação os abre. A selfie é comparada com o documento por uma pessoa da
        equipe; não fazemos reconhecimento facial. Os dados da conta de recebimento (CPF ou CNPJ, data de nascimento,
        endereço e renda) vão direto para o Asaas; a Reforce guarda só a identificação da conta. Se o professor conectar
        a Google Agenda, lemos apenas os períodos livres e ocupados, nunca o título ou os participantes dos compromissos.
      </p>
      <p>
        <strong>Aula online:</strong> o horário em que cada um entrou e saiu da sala, usado para confirmar a aula e
        decidir faltas e contestações. As aulas não são gravadas.
      </p>
      <p>
        <strong>Listas de espera:</strong> professores informam nome, e-mail, WhatsApp (opcional), cidade e UF,
        disciplinas, etapas, modalidades, formação, currículo (opcional) e uma mensagem (opcional). Quem pede aviso da
        abertura informa e-mail, cidade e UF, disciplinas e etapas. Nos dois casos guardamos a data da inscrição e a
        autorização de contato. Só maiores de 18 anos se inscrevem.
      </p>
      <p>
        <strong>Navegação:</strong> usamos só o cookie que mantém você conectado depois de entrar. Não usamos cookies de
        publicidade nem ferramentas de rastreamento de terceiros. Guardamos registros de acesso (endereço IP, data e
        hora) pelo prazo exigido pelo Marco Civil da Internet.
      </p>

      <h2 className="t-h3">2. Para que usamos</h2>
      <ul className="stack-2">
        <li>Mostrar professores, reservar aulas, cobrar, repassar ao professor e devolver dinheiro quando for o caso.</li>
        <li>Enviar códigos de acesso, confirmações, lembretes e avisos sobre as suas aulas.</li>
        <li>Verificar a identidade e a formação dos professores, para a segurança dos alunos.</li>
        <li>Resolver faltas, contestações e pedidos de suporte.</li>
        <li>Prevenir fraudes e proteger a plataforma.</li>
        <li>Cumprir obrigações legais, como guardar registros de pagamentos.</li>
        <li>Na lista de espera, avisar sobre a seleção e a abertura, e planejar em que cidades e disciplinas começar.</li>
      </ul>
      <p>Não vendemos dados e não os usamos para publicidade.</p>

      <h2 className="t-h3">3. Bases legais</h2>
      <p>
        Tratamos os dados para cumprir o contrato com você (reservas, pagamentos, repasses), para cumprir obrigações
        legais e fiscais, pelo legítimo interesse de manter a plataforma segura (verificação de professores e prevenção
        de fraudes) e, nos avisos por WhatsApp e nas listas de espera, com o seu consentimento, que você pode retirar a
        qualquer momento.
      </p>

      <h2 className="t-h3">4. Dados de crianças e adolescentes</h2>
      <p>
        O aluno menor de idade não se cadastra: quem informa o primeiro nome e a série é o responsável, que consente com
        o uso desses dados para a aula. Pedimos o mínimo de dados do aluno, sempre no melhor interesse dele. As conversas
        são entre o responsável e o professor, e contatos pessoais ficam ocultos nas mensagens.
      </p>

      <h2 className="t-h3">5. Com quem compartilhamos</h2>
      <ul className="stack-2">
        <li>
          <strong>Entre família e professor:</strong> o professor vê o nome do responsável, o primeiro nome e a série do
          aluno e as mensagens. O endereço da aula presencial só aparece para ele depois do pagamento, e só para aquela
          aula. A família vê o perfil público do professor.
        </li>
        <li><strong>Asaas:</strong> pagamentos, devoluções e conta de recebimento dos professores.</li>
        <li><strong>Daily:</strong> a sala de vídeo das aulas online.</li>
        <li><strong>Resend:</strong> o envio dos e-mails.</li>
        <li><strong>WhatsApp (Meta):</strong> os avisos, para quem escolheu recebê-los por lá.</li>
        <li><strong>Railway:</strong> a hospedagem do site e do banco de dados.</li>
        <li><strong>Google:</strong> só para o professor que conectar a própria agenda.</li>
        <li><strong>Autoridades:</strong> quando a lei ou uma ordem judicial exigir.</li>
      </ul>
      <p>
        Esses fornecedores usam os dados só para prestar o serviço à Reforce. Daily, Resend, Railway, Meta e Google podem
        processar dados fora do Brasil, com as garantias previstas na LGPD para transferência internacional.
      </p>

      <h2 className="t-h3">6. Por quanto tempo</h2>
      <ul className="stack-2">
        <li>Os dados da conta ficam guardados enquanto ela existir.</li>
        <li>
          Quando a conta é encerrada, apagamos ou anonimizamos os dados, exceto o que a lei manda guardar: registros de
          pagamento pelo prazo fiscal (5 anos) e registros de acesso pelo prazo do Marco Civil da Internet (6 meses).
        </li>
        <li>
          Os documentos de verificação do professor são apagados quando a conta dele é encerrada, salvo se forem
          necessários para uma contestação ou obrigação legal em andamento.
        </li>
        <li>
          Lista de espera: professores, até o fim da seleção; quem pediu aviso, até a abertura na sua cidade. Ou antes,
          se você pedir a exclusão.
        </li>
      </ul>

      <h2 className="t-h3">7. Seus direitos</h2>
      <p>
        Você pode pedir a confirmação de que tratamos seus dados, acesso a eles, correção, anonimização ou exclusão,
        portabilidade, informação sobre com quem compartilhamos, e retirar um consentimento. Escreva para {mail}. Para
        proteger a sua conta, confirmamos o pedido pelo e-mail cadastrado. Respondemos em até 15 dias. Você também pode
        reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
      </p>

      <h2 className="t-h3">8. Segurança</h2>
      <p>
        O site usa conexão criptografada (HTTPS). O acesso é por código enviado ao e-mail, sem senha para vazar. Os
        documentos dos professores ficam criptografados, e o acesso da equipe é restrito. Se acontecer um incidente que
        possa causar risco ou dano relevante, avisamos você e a ANPD.
      </p>

      <h2 className="t-h3">9. Mudanças nesta política</h2>
      <p>Quando houver mudança importante, avisamos por e-mail antes de ela valer. A data no topo mostra a versão atual.</p>
    </LegalShell>
  );
}
