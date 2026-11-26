/**
 * Textos da página para professores (lista de espera), reescritos em 21/11
 * pelas regras de texto da skill design-taste-frontend (copy.md): o título
 * diz o que é e para quem, cada seção tem um título que nomeia a coisa e as
 * respostas da FAQ são curtas. Só promessas que o sistema cumpre, as mesmas
 * da versão anterior (docs/superpowers/specs/2026-11-16-lista-de-espera-visual-design.md).
 * As comissões vêm da configuração ({busca} e {link}).
 *
 * Voz: direta e prática, de colega para colega; "você" para o professor,
 * "a Reforce" como sujeito do que a plataforma faz; sem adjetivo sobre nós.
 */
export const HERO = {
  kicker: 'Lista de espera aberta para professores',
  title: 'Agenda e cobrança para professores',
  lead: 'Sua página com os horários livres, pagamento por PIX ou cartão na reserva e sala de aula online. Nos alunos que você traz, a Reforce fica com {link} da aula.',
  primary: 'Quero dar aula',
  secondary: 'Ver como funciona',
  float: { day: 'Terça', time: '15:00', title: 'Matemática online, paga por PIX' },
} as const;

export const STEPS_TITLE = 'Da inscrição à primeira aula paga em 3 passos';
export const STEPS = [
  {
    title: 'Entre na lista e seja verificado como professor',
    text: 'Leva poucos minutos. Quando a seleção abrir na sua cidade, você envia documento e formação, e a equipe confere. Para dar aula presencial, também a certidão de antecedentes, que sai de graça pela internet.',
  },
  {
    title: 'Monte sua página e sua agenda',
    text: 'Você define o preço de cada tipo de aula e os horários livres. Online, na casa do aluno ou no seu endereço.',
  },
  {
    title: 'Dê a aula e receba',
    text: 'O aluno paga na reserva. Pago por PIX, o valor é liberado para você 24 horas depois da aula.',
  },
] as const;

export const FEATURES_TITLE = 'Cobrança, lembretes e sala de aula.';
export const FEATURES_MUTED = 'Tudo dentro da Reforce.';
export const FEATURES = [
  { title: 'Cobra a aula na reserva', text: 'PIX ou cartão, pago antes da aula. Aluno com horário fixo paga cada semana por PIX. Se faltar, você recebe.' },
  { title: 'Lembra o aluno da aula', text: 'Lembretes 24 h e 1 h antes, para o aluno e para você, por WhatsApp e e-mail.' },
  { title: 'Abre a sala de aula online', text: 'No navegador do computador ou do celular. Abre 10 minutos antes.' },
  { title: 'Mostra seu selo de professor verificado', text: 'Identidade e formação conferidas. O selo fica na sua página.' },
] as const;

export const FAQ_TITLE = 'Perguntas dos professores';
/** {busca} e {link} viram as comissões configuradas (COMMISSION_MARKETPLACE_BPS e COMMISSION_TEACHER_LINK_BPS). */
export const FAQ = [
  {
    q: 'Quanto custa para o professor?',
    a: 'Entrar na lista é grátis. Depois, a Reforce fica com {busca} das aulas de alunos que chegam pela busca do site e com {link} das aulas de alunos que você traz pelo seu link. As tarifas do PIX e do cartão ficam com a Reforce.',
  },
  {
    q: 'Quando eu recebo?',
    a: 'Pago por PIX, o valor é liberado 24 horas depois da aula. Pago no cartão, quando a operadora repassa, em cerca de 30 dias. Se o responsável contestar a aula nesse prazo, a equipe confere o registro da aula antes de liberar.',
  },
  {
    q: 'Preciso ter CNPJ?',
    a: 'Não. Você abre uma conta de recebimento no Asaas, nosso parceiro de pagamentos, com o seu CPF (ou CNPJ, se tiver), e transfere para o seu banco quando quiser.',
  },
  {
    q: 'Dá para ter aluno fixo toda semana?',
    a: 'Sim. Depois da primeira aula paga, a família pode repetir o horário toda semana. Ele fica reservado, e o PIX de cada aula chega 5 dias antes. Sem pagamento até 24 horas antes, só aquela aula é cancelada.',
  },
  {
    q: 'Como acompanho o que recebi?',
    a: 'No painel, em Recebimento. O extrato de cada mês mostra aula por aula: o valor, a comissão e o que é seu, com a planilha para baixar.',
  },
  {
    q: 'Posso levar os alunos que já tenho?',
    a: 'Sim. Quem chega pelo seu link fica marcado como seu aluno e paga só {link} de comissão, mesmo que depois encontre você pela busca.',
  },
  {
    q: 'Como é a aula online?',
    a: 'Na sala de vídeo da Reforce, no navegador. Ela abre 10 minutos antes e registra quem entrou, e esse registro confirma a aula. A aula não é gravada.',
  },
  {
    q: 'E a aula presencial?',
    a: 'No seu endereço ou na casa do aluno, até a distância que você escolher. O endereço do aluno só aparece depois do pagamento, e na primeira aula um adulto precisa estar em casa.',
  },
  {
    q: 'E se o aluno faltar?',
    a: 'Você recebe a aula inteira. Se o aluno justificar, você pode devolver o valor pelo painel. Se quem faltar for você, o aluno recebe o dinheiro de volta.',
  },
  {
    q: 'Quem pode participar?',
    a: 'Professores de qualquer disciplina, do 6º ano ao pré-vestibular, inclusive universitários. Para o selo, a equipe confere documento com selfie e formação. Quem dá aula presencial também envia a certidão de antecedentes criminais, que sai de graça pela internet.',
  },
];

export const pct = (bps: number) => `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(bps / 100)}%`;

/** Troca {busca} e {link} pelas comissões configuradas. */
export function withCommission(text: string, bps: { marketplace: number; teacher_link: number }) {
  return text.replaceAll('{busca}', pct(bps.marketplace)).replaceAll('{link}', pct(bps.teacher_link));
}

/** Perguntas frequentes com as comissões configuradas no lugar de {busca} e {link}. */
export function faqWithCommission(bps: { marketplace: number; teacher_link: number }) {
  return FAQ.map(({ q, a }) => ({ q, a: withCommission(a, bps) }));
}

export const FORM_TITLE = 'Lista de espera dos primeiros professores';
export const FORM_LEAD =
  'Sem custo e sem compromisso. Avisamos por e-mail e WhatsApp quando a seleção abrir na sua região e disciplina.';

export const CLOSE = {
  title: 'Seu lugar entre os primeiros professores',
  lead: 'A abertura é por cidade, e quem está na lista recebe o convite primeiro.',
};
