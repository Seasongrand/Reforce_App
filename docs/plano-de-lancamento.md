# Plano de lançamento da Reforce

Escrito em 26/11/2026. O site está no ar em modo lista de espera, com o domínio reforce.app.br. O produto completo (busca, reserva, pagamento, sala de aula, contestação, horário fixo, comprovante e extrato) está pronto e fechado ao público.

Onde está `[DEFINIR]`, a decisão é do dono.

## 1. Objetivo

**Primeiro marco:** a primeira cidade com professores verificados e famílias pagando aulas toda semana, sem a equipe empurrar cada reserva.

**Métrica principal (estrela-guia):** aulas pagas e dadas por semana. Ela só sobe quando os dois lados funcionam: tem professor com horário e família que paga e volta.

Métricas de apoio, olhadas toda semana:

| Métrica | Onde ver | Por que importa |
|---|---|---|
| Professores verificados e vendendo | /interno, Professores | sem oferta, a busca fica vazia |
| Professores com horário livre nos próximos 7 dias | busca | oferta de verdade, não só cadastro |
| Reservas pagas | /interno, Aulas | a família confiou o suficiente para pagar |
| Aulas com horário fixo semanal | banco: `weekly_series` ativas | é o que faz a família voltar |
| Contestações e faltas do professor | /interno, Contestações | qualidade; uma alta aqui pede ação antes de crescer |

## 2. Por onde começar: uma cidade, poucas disciplinas

Um marketplace precisa dos dois lados no mesmo lugar ao mesmo tempo. Abrir no Brasil inteiro espalha os poucos professores e deixa a busca vazia em quase toda cidade.

- **Cidade: São Paulo** (decisão do dono, 27/11). A lista de espera ainda estava vazia nessa data, então a escolha não veio dos inscritos.
- **Disciplinas: Matemática, Física e Redação** (escolha do agente a pedido do dono, 27/11), entre as quatro do catálogo. Matemática é a de maior procura no reforço; Física é a que mais pesa no ensino médio e no vestibular entre as exatas; Redação atende o ENEM e o vestibular, que em São Paulo têm muita procura. Química fica para depois. Rever quando a lista de espera tiver inscritos em /equipe › Por disciplina.
- **Online primeiro.** A aula online não depende de distância, então um professor da cidade atende qualquer aluno. O presencial entra quando houver professores com a certidão aprovada.
- **Quando passar para a próxima cidade:** quando a primeira tiver, por 4 semanas seguidas, mais aulas pagas do que na semana anterior e menos de uma contestação aceita a cada 20 aulas. Os dois números são uma sugestão `[DEFINIR]`.

## 3. Fases

### Fase 0: pré-requisitos (antes de qualquer convite)

Nada abre sem isto. A maior parte é do dono.

| Item | Responsável | Situação |
|---|---|---|
| Plano pago do Railway (o atual vence em 16/12) | dono | pendente |
| Domínio reforce.app.br com https | Claude | DNS pronto, esperando o certificado |
| Trocar o endereço do site (`APP_BASE_URL`) para o domínio | Claude | depois do certificado |
| Resend: conta, domínio verificado e chave | dono cria a conta; Claude configura o DNS | pendente |
| Daily (sala de vídeo): conta e chave | dono | pendente |
| Asaas em produção: conta da empresa e chave | dono | pendente |
| CNPJ | dono | pendente |
| WhatsApp Business: número, verificação da empresa e aprovação dos modelos de mensagem | dono | pendente; a lista está em `docs/pendencias.md` |
| Termos de uso e política de privacidade revisados por advogado (LGPD, menores, intermediação de pagamento) | dono | pendente |
| Fotos reais de aulas no site | dono | pendente; hoje são fotos de banco de imagens |

### Fase 1: piloto fechado (2 a 4 semanas)

**Quem:** 10 a 20 professores da lista na cidade escolhida e as famílias que eles mesmos trazem.

Por que começar com os alunos dos próprios professores: o professor já tem a confiança da família, paga a comissão menor (a do link) e testa tudo de verdade. Isso inclui pagamento, sala de aula, lembretes, repasse e extrato, sem depender da busca ainda vazia.

Passos:
1. Convidar os professores da lista, um por um, por WhatsApp. É conversa, não disparo em massa.
2. Acompanhar o cadastro de cada um: documentos, foto, conta de recebimento e agenda. A meta é aprovar em até 2 dias úteis.
3. Pedir a cada professor que mande o próprio link para 2 ou 3 famílias que já atende.
4. Depois das primeiras aulas, fazer uma entrevista curta com cada professor e com algumas famílias. Para preparar, use as skills `interview-script` e, depois, `summarize-interview`.
5. Corrigir o que travou antes de abrir a busca.

**Sai da fase quando:** pelo menos 10 professores tiverem dado aula paga pela plataforma, o repasse tiver chegado na conta deles, e nenhum problema grave de pagamento ou sala de aula estiver aberto.

### Fase 2: abertura na cidade (busca aberta)

1. Trocar `SITE_MODE` para o modo completo. A página para famílias e a busca abrem.
2. Avisar por e-mail e WhatsApp os alunos da lista de espera daquela cidade, a partir da planilha dos alunos em /equipe. A lista já tem disciplina e série de cada um.
3. Convidar o resto dos professores da lista na cidade.
4. Professores divulgam o próprio link. Na comissão menor, é o canal mais barato e mais confiável.

### Fase 3: crescer

Só depois do critério da seção 2. Uma cidade nova por vez, repetindo as fases 1 e 2.

## 4. Canais

Em ordem de custo e de confiança, do mais barato e confiável para o mais caro:

1. **Link do próprio professor.** Já está no produto: o professor compartilha a página dele pelo WhatsApp e paga só a comissão do link. Antes da abertura, vale fazer um modelo de mensagem pronta para ele copiar.
2. **Lista de espera.** Os alunos já disseram cidade, disciplina e série.
3. **Grupos de WhatsApp e de Facebook de pais da cidade e de escolas.** Sempre por indicação de quem está no grupo, nunca por spam.
4. **Busca do Google (SEO local).** Páginas como "aula particular de matemática em [cidade]" com os professores reais. É trabalho de médio prazo; as skills `seo-audit`, `programmatic-seo` e `schema` ajudam a fazer quando houver professores suficientes.
5. **Anúncio pago.** Só depois que a conversão da busca para reserva estiver medida. Antes disso, é dinheiro sem saber o retorno.

Datas boas para empurrar: semanas de prova e de recuperação no fim de cada bimestre e no fim do ano, e a reta final do ENEM. Recomeçar a divulgação em fevereiro, com a volta às aulas.

## 5. Mensagem

O que dizer em cada lado, com base no que o produto faz de verdade:

- **Para o professor:** agenda e cobrança num lugar só, com pagamento antes da aula, lembretes automáticos e o dinheiro na conta 24 horas depois da aula paga por PIX. Pelos alunos que ele mesmo traz, a comissão é a menor.
- **Para a família:** professor com identidade e formação conferidas, pagamento só na reserva e dinheiro de volta se o professor faltar. Se algo der errado, a família contesta em até 24 horas.

Evitar o que não dá para provar ainda: número de professores, notas médias, "o melhor", "o mais barato". Quando houver avaliações reais, elas entram no site.

## 6. Riscos e o que fazer

| Risco | Sinal | O que fazer |
|---|---|---|
| Busca vazia na abertura | família busca e não acha horário | abrir só nas disciplinas com oferta; conversar com professores para abrir mais horários |
| Professor e família combinam por fora depois da primeira aula | professor some depois de 1 ou 2 aulas com a mesma família | o horário fixo com cobrança automática é a defesa; mostrar ao professor o valor do lembrete, do pagamento garantido e do extrato |
| Falta do professor | contestação ou falta registrada | a família recebe o dinheiro de volta automaticamente; quem faltar de novo é pausado em /interno › Professores |
| Mensagem de WhatsApp não aprovada na Meta | modelo recusado | o e-mail cobre sozinho enquanto isso; reescrever o modelo como mensagem de utilidade |
| Atraso na aprovação de documentos | professor parado em análise | meta de 2 dias úteis; olhar /interno › Verificações todo dia na fase 1 |

## 7. Ordem prática, a partir de hoje

1. Plano do Railway (dono).
2. Certidão do domínio e troca do endereço do site (Claude, assim que o https sair).
3. Resend, Daily e Asaas em produção (dono cria as contas; Claude configura).
4. Termos e privacidade revisados (dono, com advogado).
5. ~~Escolher a cidade e as disciplinas~~: São Paulo; Matemática, Física e Redação (27/11).
6. Convidar os primeiros professores (fase 1).
