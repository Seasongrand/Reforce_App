/**
 * Textos da página da lista de espera (direção C), aprovados na especificação
 * docs/superpowers/specs/2026-11-16-lista-de-espera-visual-design.md.
 * Só promessas que o sistema cumpre; nenhum valor de comissão.
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
export const FAQ = [
  {
    q: 'Quanto custa para o professor?',
    a: 'Entrar na lista de espera não custa nada. Quando você der aulas pela Reforce, a plataforma fica com uma porcentagem de cada aula paga. Você conhece o valor antes de aceitar participar.',
  },
  { q: 'Quando eu recebo?', a: 'O aluno paga na hora da reserva. O valor fica guardado e é liberado para você 24 horas depois da aula, se ninguém contestar.' },
  { q: 'Preciso ter CNPJ?', a: 'Não. Dá para receber como pessoa física, com o seu CPF, em uma conta no seu nome.' },
  {
    q: 'Posso levar os alunos que já tenho?',
    a: 'Sim. Mande o link da sua página para eles: a reserva, o pagamento e os lembretes passam a ser feitos pela plataforma.',
  },
  { q: 'Como é a aula online?', a: 'Na sala da própria Reforce, direto no navegador do computador ou do celular. Não precisa de Zoom, de Meet nem de instalar nada.' },
  {
    q: 'E se o aluno faltar?',
    a: 'Você recebe a aula inteira. Se o aluno justificar a falta, você pode devolver o valor a ele pelo seu painel, em até 24 horas depois da aula. Se quem faltar for você, o aluno recebe o dinheiro de volta.',
  },
  {
    q: 'Quem pode participar?',
    a: 'Professores de qualquer disciplina, do 6º ano ao pré-vestibular, que passem pela verificação de identidade, antecedentes criminais e formação. A plataforma abre aos poucos, por cidade e disciplina; quem está na lista é avisado primeiro.',
  },
  { q: 'Quando a plataforma abre?', a: 'Estamos formando o primeiro grupo de professores. Quem está na lista é avisado primeiro.' },
] as const;

export const FORM_TITLE = 'Garanta seu lugar entre os primeiros';
export const FORM_LEAD =
  'Sem custo e sem compromisso. Avisamos por e-mail e WhatsApp quando abrirmos a seleção na sua região e disciplina.';
