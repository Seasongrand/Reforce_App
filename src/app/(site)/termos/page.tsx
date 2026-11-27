import type { Metadata } from 'next';
import { LegalShell } from '@/components/site/LegalShell';
import { config } from '@/config';

export const metadata: Metadata = { title: 'Termos de uso · Reforce' };
export const dynamic = 'force-dynamic';

/**
 * Termos de uso, escritos a partir do que o sistema faz (prazos lidos da
 * configuração). Versão inicial sem revisão jurídica: docs/pendencias.md.
 * Quem muda uma regra no código muda o texto aqui também.
 */
export default function TermsPage() {
  const c = config();
  const pct = (bps: number) => `${(bps / 100).toLocaleString('pt-BR')}%`;
  return (
    <LegalShell title="Termos de uso" updated="27 de novembro de 2026">
      <p>
        Estes termos valem para quem usa a Reforce: famílias que reservam aulas e professores que dão aulas pela
        plataforma. Ao criar uma conta ou pagar uma aula, você concorda com eles. Leia também a{' '}
        <a href="/privacidade">política de privacidade</a>.
      </p>

      <h2 className="t-h3">1. O que a Reforce faz</h2>
      <p>
        A Reforce é uma plataforma que liga famílias a professores particulares. Ela mostra o perfil e a agenda de cada
        professor, recebe o pagamento, guarda a parte do professor até a aula acontecer, abre a sala da aula online e
        envia os avisos. Quem dá a aula é o professor, que trabalha por conta própria: ele não é funcionário da Reforce e
        decide o próprio preço, a duração e os horários.
      </p>

      <h2 className="t-h3">2. Quem pode usar</h2>
      <ul className="stack-2">
        <li>Só maiores de 18 anos criam conta.</li>
        <li>
          A conta da família é do responsável. O aluno menor de idade não tem conta nem login: o responsável informa só o
          primeiro nome e a série dele.
        </li>
        <li>Professores passam pela verificação descrita no item 4 antes de aparecer na busca.</li>
      </ul>

      <h2 className="t-h3">3. Sua conta</h2>
      <p>
        Você entra com um código enviado ao seu e-mail, sem senha. Mantenha o acesso ao seu e-mail seguro: quem recebe o
        código entra na conta. Cada pessoa tem uma conta, com dados verdadeiros.
      </p>

      <h2 className="t-h3">4. Professores</h2>
      <ul className="stack-2">
        <li>
          Para aparecer na busca, o professor envia um documento com foto e uma selfie, que a equipe confere, e comprova a
          formação.
        </li>
        <li>
          Para dar aula presencial, envia também a certidão de antecedentes criminais, renovada a cada{' '}
          {c.criminalRecordValidityMonths} meses.
        </li>
        <li>O professor mantém o perfil verdadeiro e atualizado, e cumpre os horários que abriu na agenda.</li>
        <li>
          O professor recebe por uma conta de recebimento no Asaas, a empresa de pagamentos que a Reforce usa. Os impostos
          sobre o que ele recebe são responsabilidade dele.
        </li>
        <li>Faltas ou cancelamentos repetidos podem levar à pausa ou à suspensão do perfil.</li>
      </ul>

      <h2 className="t-h3">5. Reserva, pagamento e comissão</h2>
      <ul className="stack-2">
        <li>
          Ao escolher um horário, ele fica separado para você por {c.holdMinutes} minutos enquanto você paga. Sem
          pagamento nesse prazo, o horário volta para a agenda.
        </li>
        <li>
          O pagamento é feito por PIX ou cartão e processado pelo Asaas. A família paga o preço mostrado na página do
          professor, sem taxa extra.
        </li>
        <li>
          A comissão da Reforce sai da parte do professor: {pct(c.commissionBps.marketplace)} quando a família chega pela
          busca da Reforce e {pct(c.commissionBps.teacher_link)} quando chega pelo link do próprio professor.
        </li>
        <li>
          A parte do professor fica retida desde o pagamento e só é liberada depois da aula e do prazo de contestação
          (item 8).
        </li>
        <li>Aulas marcadas pela Reforce são pagas pela Reforce, não por fora.</li>
      </ul>

      <h2 className="t-h3">6. Cancelar e remarcar</h2>
      <ul className="stack-2">
        <li>
          Até 24 horas antes da aula, a família pode cancelar com devolução integral ou remarcar para outro horário livre.
        </li>
        <li>Com menos de 24 horas, a família pode só remarcar, sem devolução.</li>
        <li>Cada aula pode ser remarcada até 2 vezes.</li>
        <li>Se o professor cancelar uma aula paga, a família recebe o valor inteiro de volta.</li>
      </ul>

      <h2 className="t-h3">7. Faltas</h2>
      <ul className="stack-2">
        <li>
          Aula online: se o professor não entrar na sala em até {c.teacherNoShowMinutes} minutos do início e o aluno
          estiver lá, conta como falta do professor e a família recebe o valor inteiro de volta.
        </li>
        <li>
          Se o professor estiver na sala e o aluno não entrar, conta como falta do aluno. Nesse caso o professor recebe{' '}
          {c.studentNoShowTeacherPct === 100 ? 'o valor da aula' : `${c.studentNoShowTeacherPct}% do valor da aula`}. Se o aluno
          justificar a falta, o professor pode devolver o valor à família pelo painel.
        </li>
        <li>
          Aula presencial: a família recebe um código de presença e o informa ao professor na chegada; ele digita o
          código no painel. Quando não há registro, a equipe decide olhando o que aconteceu.
        </li>
      </ul>

      <h2 className="t-h3">8. Contestação</h2>
      <p>
        Se a aula não aconteceu como devia, a família pode contestar em até {c.disputeWindowHours} horas depois do fim,
        pela própria conta, uma vez por aula. Enquanto a contestação está aberta, o dinheiro do professor fica retido. A
        equipe decide com os registros da sala (quem entrou e por quanto tempo) ou do código de presença, e avisa os
        dois. Se a decisão for a favor da família, o valor da aula é devolvido.
      </p>

      <h2 className="t-h3">9. Horário fixo semanal</h2>
      <ul className="stack-2">
        <li>Depois de uma aula paga, a família pode transformar aquele horário em horário fixo toda semana.</li>
        <li>A aula da semana seguinte fica reservada. O PIX dela chega 5 dias antes.</li>
        <li>Sem pagamento até 24 horas antes, aquela semana é liberada; as seguintes continuam reservadas.</li>
        <li>Três semanas seguidas sem pagamento encerram o horário fixo.</li>
        <li>A família pode encerrar quando quiser. Aulas já pagas continuam valendo.</li>
      </ul>

      <h2 className="t-h3">10. Devoluções</h2>
      <p>
        Devoluções voltam pelo mesmo meio de pagamento, pelo Asaas. O dinheiro costuma aparecer em poucos minutos no PIX;
        no cartão, o estorno pode levar até a fatura seguinte, conforme o banco. O comprovante de cada pedido fica na sua
        conta.
      </p>

      <h2 className="t-h3">11. Segurança e conduta</h2>
      <ul className="stack-2">
        <li>
          Responsável e professor conversam pelas mensagens da Reforce. Telefones, e-mails e redes sociais ficam ocultos
          nas mensagens e nas avaliações.
        </li>
        <li>O professor não pede contato pessoal do aluno nem conversa com ele fora da aula.</li>
        <li>As aulas online não são gravadas. O responsável pode acompanhar a aula.</li>
        <li>
          O endereço da aula presencial só aparece para o professor depois do pagamento, e só para aquela aula.
        </li>
        <li>
          Não é permitido ofender, assediar, discriminar ou enganar ninguém, nem usar a plataforma para algo ilegal. Quem
          fizer isso tem a conta suspensa.
        </li>
      </ul>

      <h2 className="t-h3">12. Avaliações</h2>
      <p>
        Depois da aula, a família pode avaliar o professor. A avaliação aparece no perfil dele com o primeiro nome e a
        inicial do sobrenome do responsável. A Reforce pode remover avaliações ofensivas ou que não falam da aula.
      </p>

      <h2 className="t-h3">13. O que cabe a cada um</h2>
      <p>
        A Reforce responde pelo funcionamento da plataforma, pelo pagamento e pelas devoluções previstas nestes termos. O
        conteúdo e a qualidade da aula são de responsabilidade do professor. Nenhuma aula garante nota ou aprovação.
      </p>

      <h2 className="t-h3">14. Encerrar a conta</h2>
      <p>
        Você pode pedir o encerramento da sua conta pelo e-mail da equipe. Aulas já pagas seguem as regras acima. A
        Reforce pode suspender ou encerrar contas que descumpram estes termos, avisando o motivo por e-mail.
      </p>

      <h2 className="t-h3">15. Mudanças nestes termos</h2>
      <p>
        Quando houver mudança importante, avisamos por e-mail pelo menos 15 dias antes de ela valer. Reservas já pagas
        seguem as regras do dia do pagamento.
      </p>

      <h2 className="t-h3">16. Lei aplicável</h2>
      <p>
        Estes termos seguem as leis do Brasil, incluindo o Código de Defesa do Consumidor. Quem usa a Reforce como
        consumidor pode resolver qualquer disputa no foro da própria cidade.
      </p>
    </LegalShell>
  );
}
