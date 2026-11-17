# Aluno: do perfil ao pagamento (visual novo e foto do professor)

Aprovado em 17/11/2026, com base nas maquetes do canvas “Reforce: maquetes”, página “Aluno”, telas 1 a 6.

## Por quê

Preparar, para a abertura, a experiência de quem procura aula. É o primeiro de quatro projetos do lado do aluno:

1. do perfil ao pagamento (este);
2. vitrine com busca;
3. conta do aluno com histórico e avaliações;
4. mensagens, remarcação e cancelamento.

Este caminho vem primeiro porque todo aluno passa por ele, inclusive quem chega pelo link do professor no piloto, antes da abertura. Ele também define o visual do lado do aluno.

A inspiração são as plataformas de terapia (PsyMeet, Terappia, Vittude, Psitto, Unolife): perfil centrado na foto e na confiança, agenda clara e pagamento sem sustos. Usamos os padrões, não a marca nem o visual delas.

## Objetivos

- Um perfil que passe confiança a pais de alunos menores: foto do professor, selo **“Perfil verificado”** e garantias claras.
- Reservar no celular sem se perder: passos visíveis, resumo da aula sempre à mão e botão de reservar sempre à vista.
- Pagamento sem ansiedade: tempo restante visível, PIX fácil de copiar e página que avança sozinha.
- Saber exatamente o que fazer no dia da aula.

## Fora deste projeto

- Busca e vitrine.
- Conta do aluno com histórico.
- Avaliações, mensagens, remarcação e cancelamento.
- Redesenho dos painéis do professor e da equipe. Só entram neles o envio e a análise da foto.

## O que seria um fracasso, mesmo funcionando

- Mudar regras de reserva, de pagamento ou de repasse. Este projeto é de tela, mais a foto.
- Mostrar telefone, e-mail ou endereço do professor no perfil, ou mostrar uma foto ainda não aprovada.
- Publicar uma foto com os dados escondidos no arquivo (localização do GPS, aparelho, data).
- Prometer na tela o que o sistema não cumpre.

## Abordagens consideradas (onde guardar as fotos)

| Abordagem | Troca | Decisão |
| --- | --- | --- |
| No próprio PostgreSQL, já reduzida (cerca de 50 KB por foto) | Sem serviço novo, sem custo extra e com o backup do banco; serve bem centenas de professores | **Escolhida** (decisão minha) |
| Volume de disco na Railway | Barato, mas preso a uma máquina e fora do backup do banco | Descartada |
| Armazenamento de arquivos externo (S3 ou R2) | O caminho para muitos milhares de fotos, mas pede conta e cartão | Fica para depois, atrás da mesma interface |

## Design

**Visual.** O mesmo da página da lista de espera (direção C):
- roxo-escuro, índigo e amarelo;
- Space Grotesk nos títulos e Inter no texto;
- feito para o celular primeiro, com alvos de toque de 44 px ou mais;
- textos com “aluno”; onde a regra exige, “adulto responsável”.

**1. Perfil do professor (`/p/<endereço>`).**
- **Topo:** foto, nome, selo **“Perfil verificado”** e a frase de apresentação.
- **Selo:** abre “O que verificamos”, com identidade conferida, certidão de antecedentes criminais com a validade e formação conferida.
- **Três números rápidos:** a partir de quanto, onde dá aula (online, na casa do aluno, no endereço do professor) e o próximo horário livre.
- **Disciplinas e séries, e “Sobre”:** o texto que o professor já escreve.
- **Escolha da aula:** um cartão por serviço, com disciplina, modalidade, duração e preço.
- **Horários:** os dias numa faixa e os horários do dia escolhido em grade, no fuso de quem está vendo.
- **“Sua aula protegida”:**
  - o pagamento na reserva;
  - o valor só vai para o professor depois da aula;
  - se o professor faltar, o dinheiro volta inteiro;
  - a sala online sem instalar nada.
- **“É aluno? Mande para seu responsável”:** abre o WhatsApp com o link pronto.
- **Barra fixa no rodapé:** o horário escolhido, o preço e o botão “Reservar”.
- **Professor sem venda** (certidão vencida, por exemplo): o perfil aparece com “Agenda indisponível no momento” e sem horários, como hoje.

**2 e 3. Reserva (`/p/<endereço>/reservar`).**
- **Passos no topo:** Horário, Seus dados, Pagamento.
- **Resumo da aula:** com a foto do professor.
- **Formulário do adulto responsável:**
  - campos: seu nome, WhatsApp, e-mail, primeiro nome do aluno e série;
  - a opção de receber pelo WhatsApp;
  - o endereço, só na aula na casa do aluno.
- **Tela do código:** os 6 dígitos, “Reenviar código” e “Trocar e-mail”.
- **Regras:** as de hoje (identificação, código e reserva temporária), sem mudança.
- **Horário ocupado:** continua mostrando os horários livres mais próximos.

**4. Pagamento (`/pedido/<id>`).**
- **Faixa amarela fixa:** “Horário guardado para você por mm:ss”.
- **Escolha da forma de pagamento:** PIX ou cartão.
- **PIX:**
  - QR grande;
  - botão “Copiar código PIX”, que confirma quando copiou;
  - a validade do código.
- **Cartão:** o botão para a página segura do provedor.
- **Depois do pagamento:** a página avança sozinha, como hoje.
- **Quadro “Pagamento protegido”.**
- **Reserva expirada:** a mensagem atual, no visual novo, com o caminho de volta para escolher outro horário.

**5. Aula confirmada (`/pedido/<id>/confirmado`).**
- **Cartão da aula:** data em destaque, horário no fuso do aluno, professor com a foto, primeiro nome e série do aluno, e modalidade.
- **Botões:**
  - “Ir para a página da aula”;
  - **“Adicionar à minha agenda”**, que baixa um arquivo de calendário (.ics) com a data, a hora e o link da página da aula, e funciona no Google Agenda, no iPhone e no Outlook.
- **“No dia da aula”:** os lembretes de 24 h e 1 h, a sala que abre 10 minutos antes e o funcionamento no navegador.
- **Garantia:** “Se o professor não entrar na sala em até 15 minutos, o dinheiro volta inteiro, sem precisar pedir.”
- **“Marcar a próxima aula com <nome>”:** leva de volta ao perfil.
- **Aula presencial:** o endereço e o código da aula, como hoje.

**6. Página da aula (`/aula/<token>`).**
- **Tempo até a sala abrir:** contagem regressiva e o botão “Entrar na sala”, liberado 10 minutos antes.
- **Dicas:** navegador, câmera e microfone, e que só entram o professor e o aluno.
- **Aula presencial:** o código em destaque e o endereço.
- **Aula que deixou de estar ativa:** o aviso de hoje.

**Foto do professor.**
- **Envio:**
  - pelo painel do professor, numa seção “Sua foto” do cadastro;
  - aceita JPG, PNG ou WEBP de até 5 MB;
  - o sistema recorta num quadrado, reduz para 512 px, converte para WEBP e **remove todos os dados escondidos do arquivo**.
- **Análise:**
  - a equipe vê a foto ao lado do documento de identidade, no painel de verificações, e aprova ou recusa com motivo, como os documentos;
  - **aprovar o perfil exige uma foto aprovada**.
- **Troca de foto:** a nova fica em análise, e o perfil continua mostrando a anterior até a aprovação.
- **Sem foto aprovada:** o perfil mostra as iniciais num círculo. Isso só acontece em perfis antigos, porque perfis novos não vendem sem foto.
- **Endereço público:** um caminho próprio de imagem, com cache longo, que muda quando a foto muda. No modo lista de espera, ele fica fechado, como o resto do marketplace.

**Selo “Perfil verificado”.** Aparece quando o perfil está aprovado e vendendo. Isso já exige as três verificações em dia e, daqui em diante, a foto aprovada.

## Decisões deixadas a quem implementa

- A organização dos componentes. A reutilização do topo, das cores e das letras da lista de espera é desejada.
- A tabela da foto e o caminho exato da imagem.
- A biblioteca que reduz a imagem.
- Os textos de estados raros (erros de envio da foto, por exemplo), seguindo o tom das telas.
- Como os testes cobrem cada tela. O fluxo completo no navegador precisa passar pelas telas novas, incluindo o envio e a aprovação da foto.
