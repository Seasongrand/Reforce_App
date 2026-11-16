# Lista de espera: novo visual (direção C)

Aprovado em 16/11/2026. Maquetes: canvas “Reforce: maquetes”, prancheta “C · Energética”.

## Por quê

A lista de espera é a única página aberta ao público, e o objetivo agora é **atrair mais professores** para ela. A página atual é funcional, mas crua: coluna estreita, sem identidade visual, sem respostas às dúvidas do professor e com um formulário longo de uma vez só.

Este é o primeiro de dois projetos. O segundo, a experiência das famílias e dos alunos para a abertura do marketplace, será desenhado depois, a partir deste visual.

A inspiração são as páginas com que as plataformas de terapia (PsyMeet, Terappia, Vittude, Psitto, Unolife) recrutam profissionais: abertura com a promessa, passos, vantagens, confiança, perguntas frequentes e cadastro. Usamos os padrões, não a marca nem o visual de nenhuma delas.

## Objetivos

- Convencer o professor em poucos segundos, sobretudo no celular, aberto a partir do WhatsApp.
- Responder antes as dúvidas que fazem o professor desistir: custo, recebimento, CNPJ, alunos próprios, aula online, faltas, quem pode participar e data de abertura.
- Facilitar a inscrição com um formulário em duas etapas.
- Transformar cada inscrito em divulgador, com um convite pelo WhatsApp depois da inscrição.

## Fora deste projeto

Telas das famílias, painéis do professor e da equipe, logo, domínio próprio e busca pública.

## O que seria um fracasso, mesmo funcionando

- Prometer o que o sistema não faz, ou números ainda não decididos, como a comissão.
- Perder inscrições, mudar as regras de validação ou alterar a planilha exportada.
- Copiar a marca, os textos ou o visual de outra plataforma.
- Ficar pior no celular do que a página atual.

## Abordagens consideradas

| Abordagem | Custo e troca | Decisão |
| --- | --- | --- |
| Refazer a página dentro do próprio site (Next.js com Tailwind) | O formulário continua gravando no mesmo banco e saindo na mesma planilha | **Escolhida** |
| Construtor de sites (Webflow, Framer) | Mensalidade; o formulário fica separado do banco e da planilha | Descartada |
| Página estática separada | Segunda hospedagem e o formulário duplicado | Descartada |

## Design

**Visual (direção C, “energética”).**
- **Cores:** roxo-escuro `#1E1B4B` na abertura, no formulário e no rodapé; índigo `#4F46E5` nos botões e ícones; amarelo `#FACC15` no destaque da frase de abertura e no botão do topo; fundo lilás-claro `#F5F3FF` na seção de vantagens.
- **Letras:** Space Grotesk nos títulos e Inter no texto.
- **Formas:** cantos arredondados de 12 a 22 px.
- **Logo:** sem logo, por enquanto; o nome “Reforce” fica escrito.

**Seções, nesta ordem.**
1. **Topo:** o nome “Reforce” e o botão “Quero dar aula”, que leva ao formulário.
2. **Abertura:**
   - selo “Lista de espera aberta para os primeiros professores”;
   - título “Ensine. **A cobrança** é com a gente.”;
   - subtítulo com as disciplinas e as etapas;
   - botões “Entrar na lista de espera” e “Como funciona”;
   - três avisos de exemplo: “Reserva confirmada”, “Lembrete enviado à família” e “Aula concluída”.
3. **“Quatro passos até a primeira aula paga”:** entrar na lista, ser verificado, montar a agenda, dar a aula e receber.
4. **“Você cuida da aula. O resto é automático”:** seis vantagens.
   - Página e horários próprios.
   - Sem cobrar ninguém.
   - Aluno faltou, aula paga.
   - Selo de verificado.
   - Sala de aula online própria: “sem Zoom, sem Meet e sem instalar nada”.
   - Lembretes automáticos.
5. **Perguntas frequentes:** oito perguntas que abrem e fecham. Os textos estão abaixo.
6. **Formulário em duas etapas,** no fundo roxo, com o título “Garanta seu lugar entre os primeiros”.
7. **Rodapé:** o nome, uma frase e o link da política de privacidade.

**Perguntas frequentes (textos aprovados).**
- **Quanto custa para o professor?** Entrar na lista de espera não custa nada. Quando você der aulas pela Reforce, a plataforma fica com uma porcentagem de cada aula paga. Você conhece o valor antes de aceitar participar.
- **Quando eu recebo?** A família paga na hora da reserva. O valor fica guardado e é liberado para você 24 horas depois da aula, se ninguém contestar.
- **Preciso ter CNPJ?** Não. Dá para receber como pessoa física, com o seu CPF, em uma conta no seu nome.
- **Posso levar os alunos que já tenho?** Sim. Mande o link da sua página para eles: a reserva, o pagamento e os lembretes passam a ser feitos pela plataforma.
- **Como é a aula online?** Na sala da própria Reforce, direto no navegador do computador ou do celular. Não precisa de Zoom, de Meet nem de instalar nada.
- **E se o aluno faltar?** Você recebe a aula inteira. Se quem faltar for você, a família recebe o dinheiro de volta.
- **Quem pode participar?** Professores de Matemática, Física, Química e Redação, do 6º ano ao pré-vestibular, que passem pela verificação de identidade, antecedentes criminais e formação.
- **Quando a plataforma abre?** Estamos formando o primeiro grupo de professores. Quem está na lista é avisado primeiro.

**Formulário em duas etapas.**
- **Etapa 1, “Seus dados”:** nome completo, e-mail, WhatsApp (opcional), cidade e UF. Cidade e UF continuam em campos separados, como o banco guarda. O botão “Continuar” só avança com os dados obrigatórios preenchidos; caso contrário, mostra o que falta.
- **Etapa 2, “Suas aulas”:**
  - disciplinas, etapas e modalidade, escolhidas em botões de marcar;
  - formação;
  - experiência (opcional);
  - consentimento;
  - botões “Voltar” e “Entrar na lista de espera”.
- **Envio:** uma inscrição só, pela mesma ação do servidor de hoje, com as mesmas validações, o mesmo campo-armadilha contra robôs e a mesma planilha. Se o servidor recusar um dado da etapa 1, a mensagem aparece e o “Voltar” leva até ele, sem perder o que foi digitado.
- **Confirmação:**
  - “Inscrição recebida!”, com o texto atual: novo cadastro ou dados atualizados;
  - a pergunta “Conhece outro professor que ia gostar?”;
  - o botão “Convidar pelo WhatsApp”, com uma mensagem pronta e o endereço do site.

**Celular em primeiro lugar.** A página é desenhada para a largura de um celular e se abre em colunas na tela grande. Os botões têm pelo menos 44 px de altura, os textos têm contraste legível e não pode haver rolagem lateral.

**Página de privacidade.** Ganha o mesmo topo, o mesmo rodapé e as mesmas letras. O texto não muda.

**Endereço do site.** Enquanto o domínio próprio não estiver pronto, `APP_BASE_URL` na Railway passa a ser `https://reforce.up.railway.app`, para o convite pelo WhatsApp levar a um endereço que funciona.

## Decisões deixadas a quem implementa (marcadas como minhas)

- Como isolar o visual da página inicial e da privacidade sem mexer no visual das telas do marketplace, que continua o atual até o segundo projeto.
- Prévia do link no WhatsApp (título, descrição e imagem) e ícone do site, se couberem sem riscos. O modo lista de espera bloqueia todos os caminhos não listados, então cada caminho novo precisa ser liberado.
- Como testar: as duas etapas e o envio no navegador, a validação da etapa 1 em teste rápido e a ausência de rolagem lateral na largura de celular.
