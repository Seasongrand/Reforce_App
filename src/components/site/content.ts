/**
 * Textos da página da lista de espera (direção C), aprovados na especificação
 * docs/superpowers/specs/2026-11-16-lista-de-espera-visual-design.md.
 * Só promessas que o sistema cumpre. As comissões da FAQ vêm da configuração.
 */
export const HERO = {
  badge: 'Lista de espera aberta para os primeiros professores',
  titleFirst: 'Você ensina.',
  titleBefore: ' A gente ',
  titleMark: 'cuida do resto.',
  titleAfter: '',
  lead: 'Monte sua agenda, divulgue sua página e receba depois de cada aula. Todas as disciplinas, do 6º ano ao pré-vestibular.',
  primary: 'Entrar na lista de espera',
  secondary: 'Como funciona',
  examples: [
    { icon: 'check', title: 'Reserva confirmada', text: 'Ter, 15:00 · Matemática online · pago por PIX' },
    { icon: 'bell', title: 'Lembrete enviado ao aluno', text: '24 h antes, por WhatsApp e e-mail' },
    { icon: 'card', title: 'Aula concluída', text: 'O valor foi liberado para você' },
  ],
} as const;

export const STEPS_TITLE = 'Quatro passos até a primeira aula paga';
export const STEPS = [
  { title: 'Entre na lista', text: 'Leva poucos minutos. Avisamos quando a seleção abrir na sua cidade e disciplina.' },
  { title: 'Seja verificado', text: 'Envie identidade, certidão de antecedentes e comprovante de formação. A equipe aprova seu perfil.' },
  { title: 'Monte sua agenda', text: 'Seus horários, o seu preço e onde dá aula: online, na casa do aluno ou no seu endereço.' },
  { title: 'Dê a aula e receba', text: 'O aluno paga na reserva. Depois da aula, o valor é liberado para você.' },
] as const;

export const BENEFITS_TITLE = 'Você cuida da aula. O resto é automático.';
export const BENEFITS = [
  { icon: 'link', title: 'Sua página, seus horários', text: 'Um link só seu, com os horários livres de verdade. Mande no grupo da escola ou no seu Instagram.' },
  { icon: 'card', title: 'Sem cobrar ninguém', text: 'O aluno paga por PIX ou cartão na reserva. Acabou o constrangimento de lembrar o pagamento.' },
  { icon: 'check', title: 'Aluno faltou, aula paga', text: 'O valor fica guardado e é liberado depois da aula, mesmo que o aluno não apareça.' },
  { icon: 'shield', title: 'Selo de verificado', text: 'Identidade, antecedentes criminais e formação conferidos. Os pais confiam mais, e você se destaca.' },
  {
    icon: 'video',
    title: 'Sala de aula online própria',
    text: 'A aula online acontece dentro da Reforce, direto no navegador: sem Zoom, sem Meet e sem instalar nada. Prefere presencial? Na casa do aluno ou no seu endereço, com o deslocamento já contado na agenda.',
  },
  { icon: 'bell', title: 'Ninguém esquece a aula', text: 'Confirmação e lembretes 24 h e 1 h antes, por WhatsApp e e-mail, para você e para o aluno.' },
] as const;

export const FAQ_TITLE = 'Perguntas frequentes';
/**
 * {busca} e {link} viram as comissões configuradas (COMMISSION_MARKETPLACE_BPS e
 * COMMISSION_TEACHER_LINK_BPS), para a página nunca prometer outro valor (ver faqWithCommission).
 */
export const FAQ = [
  {
    q: 'Quanto custa para o professor?',
    a: 'Entrar na lista de espera é grátis. Quando você der aulas, a Reforce fica com {busca} de cada aula paga por alunos que chegam pela busca do site e com só {link} das aulas dos alunos que você mesmo traz pelo seu link. As tarifas do PIX e do cartão ficam por conta da Reforce. Qualquer outro custo é informado antes de você aceitar participar.',
  },
  {
    q: 'Quem define o preço da aula?',
    a: 'Você. Para cada tipo de aula que oferece, você define o seu preço, e é esse valor que o aluno vê na sua página e paga. A comissão sai desse valor: o aluno não paga nada a mais.',
  },
  {
    q: 'Quando eu recebo?',
    a: 'O aluno paga na reserva e o valor fica guardado até a aula. Pago por PIX, ele é liberado para você 24 horas depois da aula. Pago no cartão, é liberado quando a operadora do cartão repassa o dinheiro, em cerca de 30 dias. Se o responsável contestar a aula nessas 24 horas, a equipe confere o registro de presença antes de liberar.',
  },
  {
    q: 'Preciso ter CNPJ?',
    a: 'Não. Pelo seu painel, você abre uma conta de recebimento no Asaas, nosso parceiro de pagamentos, no seu nome, com o seu CPF (ou CNPJ, se tiver). De lá, você transfere para o seu banco quando quiser. Os impostos sobre o que você ganha continuam por sua conta, como em qualquer aula particular.',
  },
  {
    q: 'Posso levar os alunos que já tenho?',
    a: 'Sim, e é o jeito mais barato de usar a Reforce. Mande o link da sua página para eles: quem chega pelo seu link fica marcado como seu aluno e paga só {link} de comissão, mesmo que depois encontre você pela busca. A reserva, o pagamento e os lembretes passam a ser feitos pela plataforma.',
  },
  {
    q: 'Como é a aula online?',
    a: 'Na sala de vídeo da própria Reforce, direto no navegador do computador ou do celular: sem Zoom, sem Meet e sem instalar nada. A sala abre 10 minutos antes do horário e registra quem entrou, e é esse registro que confirma a aula e libera o seu pagamento. A aula não é gravada.',
  },
  {
    q: 'E a aula presencial?',
    a: 'Pode ser no seu endereço ou na casa do aluno, até a distância que você escolher (até 100 km), com o tempo de deslocamento já contado na sua agenda. O endereço do aluno só aparece para você depois do pagamento. Na chegada, o aluno informa o código da aula, que você digita no painel para registrar a presença. Na primeira aula, um adulto precisa estar em casa.',
  },
  {
    q: 'E se o aluno faltar?',
    a: 'Você recebe a aula inteira. Na aula online, a falta fica registrada pela sala: você entrou e o aluno não. Na presencial, sem o código da aula, a equipe confere o que aconteceu. Se o aluno justificar a falta, você pode devolver o valor a ele pelo seu painel, em até 24 horas depois da aula. Se quem faltar for você, ou se você entrar na sala mais de 15 minutos atrasado, o aluno recebe o dinheiro de volta inteiro.',
  },
  {
    q: 'Quem pode participar?',
    a: 'Professores de qualquer disciplina, do 6º ano ao pré-vestibular, inclusive quem ainda está cursando a faculdade. Para ganhar o selo de verificado, você envia documento com foto e uma selfie, a certidão de antecedentes criminais da Polícia Federal (gratuita, no gov.br) e o diploma, o histórico ou a declaração de matrícula. A equipe confere tudo antes de liberar o seu perfil, e a certidão precisa ser renovada quando vence.',
  },
  {
    q: 'Quando a plataforma abre?',
    a: 'Estamos formando o primeiro grupo de professores. A abertura é por cidade, quando houver professores verificados suficientes para atender os alunos; a aula online pode atender alunos de todo o Brasil. Quem está na lista recebe primeiro, por e-mail e WhatsApp, o convite para criar a conta e fazer a verificação.',
  },
];

const pct = (bps: number) => `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(bps / 100)}%`;

/** Perguntas frequentes com as comissões configuradas no lugar de {busca} e {link}. */
export function faqWithCommission(bps: { marketplace: number; teacher_link: number }) {
  return FAQ.map(({ q, a }) => ({ q, a: a.replaceAll('{busca}', pct(bps.marketplace)).replaceAll('{link}', pct(bps.teacher_link)) }));
}

export const FORM_TITLE = 'Garanta seu lugar entre os primeiros';
export const FORM_LEAD =
  'Sem custo e sem compromisso. Avisamos por e-mail e WhatsApp quando abrirmos a seleção na sua região e disciplina.';
