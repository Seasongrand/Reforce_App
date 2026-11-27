# Pendências que dependem de você

O que o código trata como configuração provisória, ou que depende de uma decisão, credencial ou validação externa. Valores entre crases são variáveis de ambiente (veja `.env.example`). Estado em 16/11/2026, ao fim da Fase 1.

## 1. Decisões de produto

| Tema | Situação no código | O que preciso de você |
| --- | --- | --- |
| Cidade de lançamento | Não afeta a Fase 1 (não há busca pública). O raio de atendimento é por professor | Definir a cidade do presencial |
| Disciplinas | Desde 27/11, por decisão do dono, o marketplace abre com as 16 disciplinas da lista de espera (`src/domain/catalog.ts`, mesmos ids de `WAITLIST_SUBJECTS`). O pré-deploy da Railway roda `db:seed`, que grava o catálogo no banco | Feito |
| Séries | 6º ao 9º ano, 1ª a 3ª série do ensino médio e pré-vestibular | Confirmar |
| Comissão | `COMMISSION_MARKETPLACE_BPS=1500` (15%) e `COMMISSION_TEACHER_LINK_BPS=500` (5%), hipóteses do documento. Na Fase 1, toda família chega pelo link do professor e paga 5%. Desde 17/11, a FAQ dos professores mostra os dois percentuais, lidos destas variáveis | Confirmar; decidir se a taxa cai para famílias recorrentes |
| Regra de cancelamento | Não há cancelamento nem remarcação pela família (Fase 2). Decidido em 16/11: falta do professor dá reembolso integral automático; falta do aluno paga o professor por inteiro (`STUDENT_NO_SHOW_TEACHER_PCT=100`); aula presencial sem código vai para decisão da equipe | Definir a regra (única ou opções por professor) e o formato da tabela `credits` (§2.2), que ainda não foi criada |
| Piso de preço | `PRICE_FLOOR_CENTS=0` (sem piso), decidido em 16/11 | Definir o valor |
| Especialidades e experiência | Desde 19/11, o professor escolhe até 6 especialidades de uma lista fechada e informa o ano em que começou a dar aula (“N anos de experiência”). Os dois são declarados por ele, sem verificação da equipe (`TEACHER_SPECIALTIES` em `src/domain/teachers/profile.ts`) | Revisar a lista; decidir se a equipe confere a experiência |
| Quem pode dar aula | Sem restrição no código | Só formados e licenciados, ou também universitários? |
| Venda com certidão vencida | Decidido em 16/11: a página do professor deixa de vender até a nova certidão ser aprovada | Nada, salvo se mudar de ideia |

## 2. Valores sugeridos que viraram configuração

| Variável | Valor | Origem |
| --- | --- | --- |
| `HOLD_MINUTES` | 10 | §2.4 |
| `PIX_EXPIRY_LEAD_MINUTES` | 1 (o QR vence 1 minuto antes da reserva) | §2.4 |
| `DISPUTE_WINDOW_HOURS` | 24 | §1 e §2.6, “sugestão” |
| `TEACHER_NO_SHOW_MINUTES` | 15 | §1, “sugestão” |
| `CRIMINAL_RECORD_VALIDITY_MONTHS` | 6 | §3.7 (a equipe pode ajustar a data na aprovação) |
| `CALENDAR_FREEBUSY_TIMEOUT_MS` | 2000 | §2.4 |
| Antecedência, janela, grade | 120 min, 60 dias, 30 min (padrões do apêndice; cada professor ajusta) | Apêndice |

Valores que eu escolhi, sem base no documento, e que você pode querer revisar:

- Código de acesso: 6 dígitos, válido por 10 minutos, 5 tentativas e 5 pedidos por hora por e-mail.
- Código da aula presencial: aceito de 30 minutos antes do início a 2 horas depois do fim, com 5 tentativas.
- Sala de vídeo: abre 10 minutos antes e fecha 30 minutos depois da aula.
- Fechamento automático da aula: 10 minutos depois do fim.
- Serviço: duração de 30 a 240 minutos; 30 minutos de deslocamento sugeridos no presencial.
- Documentos: PDF, JPG, PNG ou WEBP, até 10 MB por arquivo.
- Varredura diária das certidões: 06h13 em São Paulo.

## 3. Credenciais e homologações

### Domínio `reforce.app.br` (registrado em 16/11/2026)

O domínio destrava várias aprovações da semana 0 (§5). Falta:

- **Endereço de produção:** `APP_BASE_URL=https://reforce.app.br` quando o domínio estiver pronto; até lá, `https://reforce.up.railway.app`. Os links das mensagens, da página do professor, da sala, do convite pelo WhatsApp e da prévia do link saem dele.
- **E-mail (Resend, desde 26/11):** domínio `reforce.app.br` verificado no Resend (registros MX, SPF e DKIM no Cloudflare). Na Railway: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` (só lá, nunca no repositório) e, se quiser outro remetente, `EMAIL_FROM` (padrão `Reforce <avisos@reforce.app.br>`). As respostas vão para `CONTACT_EMAIL`.
- **Google:** a verificação do app pede política de privacidade no mesmo domínio da página inicial e o domínio verificado no Google Search Console (§3.3). As páginas de termos de uso e de política de privacidade ainda não existem no sistema.
- **Meta (WhatsApp):** a verificação da empresa costuma pedir um site no domínio da empresa.
- **Hospedagem (Railway):** no ar desde 16/11/2026 em https://reforce.up.railway.app, no modo lista de espera (configuração no README, “Produção na Railway”). A conta está no plano de teste: 30 dias e US$ 5 de crédito a partir de 16/11/2026. Depois disso, o site precisa de um plano pago ou de outra hospedagem.
- **DNS do domínio:** `reforce.app.br` já está cadastrado no serviço da Railway, e a zona do Cloudflare já tem os registros (CNAME na raiz, TXT `_railway-verify` e CNAME `www`). O pagamento do registro no Registro.br ainda não foi feito: sem ele, o Registro.br não deixa trocar os servidores DNS e cancela o registro no prazo da cobrança. Depois do pagamento, falta trocar os servidores DNS para `daniella.ns.cloudflare.com` e `lynn.ns.cloudflare.com`, pôr o SSL/TLS do Cloudflare em “Full” e criar o redirecionamento do `www`.
- **E-mail de contato:** resolvido em 19/11: `CONTACT_EMAIL=ola.reforce@gmail.com` na Railway (e como padrão no código). Quando o domínio estiver pago, dá para trocar por um endereço do domínio (o Cloudflare encaminha e-mails de graça).
- **Política de privacidade das listas de espera:** o texto em `/privacidade` é provisório e factual, escrito por mim. Precisa de revisão jurídica, e a política completa entra antes da abertura.
- **Contas de teste da equipe:** os atalhos de `/equipe` (“Acessos da equipe”) criam um professor de teste (`professor.teste@reforce.invalid`, em rascunho), um responsável de teste (`responsavel.teste@reforce.invalid`, telefone `+5500000000000`, aluno “Aluno” do 9º ano) e o cadastro da equipe com o `CONTACT_EMAIL`. Antes da abertura, apagar o professor e o responsável de teste (e o que eles tiverem criado), para o professor de teste nunca aparecer na busca. O cadastro da equipe pode ficar: com o e-mail real configurado, o dono entra em `/interno/entrar` pelo código.
- **Aviso da abertura para alunos:** o botão "Entrar" leva a `/entrar` no modo lista de espera, e quem se inscreve recebe a promessa de aviso por e-mail. Na abertura, mandar esse e-mail a quem está em `/api/lista-de-espera/alunos.csv` (na cidade que abrir). Com o marketplace aberto, o mesmo botão leva ao login de "Minha conta".


O sistema roda inteiro com adaptadores falsos. Cada adaptador real entra quando a credencial chegar; escolher um deles antes disso falha na inicialização com mensagem clara.

- **Asaas** (`PAYMENT_PROVIDER=asaas`): conta principal com CNPJ, chave de API (`ASAAS_API_KEY`), token do webhook (`ASAAS_WEBHOOK_TOKEN`) e homologação de subcontas e da Conta Escrow. Peça na semana 0, por causa do teto de 10 subcontas e R$ 2.000 por subconta na avaliação inicial (§3.4).
- **Vídeo** (`VIDEO_PROVIDER=daily` ou `whereby`): chave de API e configuração do webhook de presença.
- **WhatsApp Cloud API** (`WHATSAPP_PROVIDER=meta`): número da plataforma, token, identificador do número e aprovação dos modelos de utilidade usados, os mesmos nomes de `src/domain/notifications/catalog.ts`: confirmação da família, lembretes de 24 h e 1 h (família e professor), confirmação ao professor, pedido de avaliação, devolução por pagamento tardio, devolução por falta do professor, devolução por falta justificada do aluno, os avisos de cancelamento e remarcação, os da contestação da aula (aberta, aceita e negada, para a família e o professor) e os do horário fixo semanal (cobrança da semana e encerramento). Os textos estão em `src/domain/notifications/templates.ts`.
- **E-mail** (`EMAIL_PROVIDER=resend`): adaptador pronto desde 26/11; falta a chave `RESEND_API_KEY` na Railway, depois do domínio verificado.
- **Google Calendar** (`CALENDAR_PROVIDER=google`): projeto no Google Cloud, OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), chave para cifrar os tokens (`CALENDAR_TOKEN_ENCRYPTION_KEY`) e pedido de verificação dos escopos `calendar.freebusy` e `calendar.app.created`.
- **Geocodificação de CEP**: serviço a escolher. Hoje o adaptador falso conhece poucos CEPs; sem coordenada, a verificação do raio do professor é pulada. A vitrine depende disso na aula presencial: com CEP desconhecido, ela avisa “Não encontramos esse CEP” e sugere aulas online.
- **Avaliações, próximos passos:** a resposta do professor (a coluna `teacher_reply` já existe), a moderação pela equipe (o estado `hidden` já existe) e um e-mail pedindo a avaliação depois da aula. Hoje a avaliação é feita em “Minha conta” (`/conta`), até 30 dias depois da aula concluída.
- **Páginas por disciplina e cidade** (busca orgânica no Google, Fase 2): ainda não existem; a vitrine atende por `/buscar?disciplina=…&serie=…`.
- **Armazenamento de arquivos**: S3 ou equivalente, privado e cifrado. Hoje os documentos ficam cifrados (AES-256-GCM) em disco local, em `FILE_STORAGE_DIR`.
- **Fotos dos professores**: ficam no PostgreSQL, já reduzidas (512×512, WEBP, cerca de 50 KB, sem metadados), na tabela `teacher_photos`, e saem por `/api/fotos/<id>` com cache longo. Com milhares de professores, vale passar para armazenamento de arquivos com CDN.

## 4. Pontos a validar com os provedores

- **Asaas, estorno com retenção ativa.** A documentação não descreve; o código chama `refund` e marca a cobrança como devolvida. Teste no ambiente de testes antes de prometer reembolso em um toque (§3.4).
- **Asaas, devolução parcial com retenção.** Só acontece se `STUDENT_NO_SHOW_TEACHER_PCT` for menor que 100. Confirme como a retenção da subconta se comporta.
- **Asaas, `daysToExpire` por subconta, mensalidade por subconta e CPF do pagador.** O código manda nome, e-mail e telefone do responsável; se o CPF for obrigatório, é um campo a mais no checkout.
- **Cartão.** O repasse é pedido 24 horas depois da aula, mas no cartão o valor só fica disponível no prazo de liquidação do provedor (cerca de 32 dias sem antecipação). Decidido em 17/11: sem antecipação; a FAQ e a tela de recebimento dizem que, no cartão, o professor recebe em cerca de 30 dias.
- **Mensalidade da conta de recebimento.** A FAQ não promete “sem mensalidade”: diz que qualquer custo além da comissão é informado antes de o professor aceitar. Taxa do Asaas já confirmada (R$ 9,90 por subconta por mês, mais R$ 99,90 da conta principal); decidir se repassa ao professor ou embute na comissão.
- **Cancelamento e remarcação.** A FAQ não fala do assunto porque o sistema ainda não tem (Fase 2). Definir a regra antes da abertura.
- **Vídeo.** Entrada restrita por participante, presença por webhook e tempo mínimo de presença para contar a aula como dada (hoje basta entrar). O papel de observador para o responsável existe na interface, mas não aparece nas telas.

## 5. Jurídico e operação

- Termos de uso e política de privacidade; parecer sobre menores (ECA, LGPD e ECA Digital), certidão de antecedentes e responsabilidade do intermediário (§ “Riscos e pontos a validar”).
- **Descarte de documentos.** O documento manda descartar o que não precisa ser guardado depois da decisão. Hoje os arquivos ficam guardados (cifrados) depois da análise. Defina o prazo de guarda de cada tipo.
- **Quem opera o painel interno** e com que prazo de resposta.

## 6. Achados técnicos

- **Impasse sem a trava por professor.** O apêndice registrou 19 recusas com `23P01` nas 20 sessões simultâneas só com a restrição. Reproduzindo de verdade, numa das oito execuções as 19 perdedoras foram recusadas com `40P01` (impasse), depois de cerca de 1 segundo por rodada de detecção. Continua gravando exatamente uma reserva. A aplicação sempre usa a trava, que elimina o problema, e trata `40P01` como “ocupado” por precaução.
- **`refresh_next_slot` ajustado** (desvio aprovado): começa um dia antes, porque `p_now::date` depende do fuso da sessão do banco.
- **Volume medido nesta máquina:** 2.000 retratos em cerca de 3 s e busca com mediana de cerca de 28 ms, devolvendo os 2.000 professores (o documento citou 1,3 s e 6 ms em outra máquina). A busca da Fase 2 vai paginar.
- **Tabelas criadas e ainda sem tela:** `teacher_search`, `teacher_next_slot` (atualizadas pelo worker), `reviews`, `messages` e `disputes` (a liberação do repasse já respeita disputa aberta). Entram nas fases seguintes sem migrar o esquema.
- **Falha intermitente sem causa encontrada.** Na verificação do zero (banco e dependências recém-criados), o teste “processa as tarefas enfileiradas pela confirmação” terminou uma vez com a tarefa `search.refresh_teacher` ainda na fila. Não se repetiu em 19 execuções seguidas. O teste agora mostra tentativas e erro da tarefa que sobrar; se voltar a acontecer, a mensagem explica a causa.

## Vídeo pelo Daily (26/11)

- Adaptador pronto (`src/providers/video/daily.ts`). Na Railway: `VIDEO_PROVIDER=daily`, `DAILY_API_KEY` (só lá), `DAILY_DOMAIN=reforce` e `DAILY_WEBHOOK_SECRET` (base64 de 32 bytes).
- O webhook de presença (`/api/webhooks/video`) é cadastrado no Daily pelo worker, ao iniciar.
- **O worker precisa rodar em produção antes da abertura** (`npm run worker`, num segundo serviço da Railway com o mesmo repositório e as mesmas variáveis). Hoje só o site (`next start`) roda; sem o worker não saem lembretes nem repasses, as reservas vencidas não são liberadas e as salas não são criadas antes da aula (a sala ainda é criada na hora em que alguém entra).

## Pagamento pelo Asaas (26/11)

- Adaptador pronto (`src/providers/payment/asaas.ts`), testado no sandbox: subconta do professor e Conta Escrow padrão funcionaram. A cobrança com split depende de habilitar o split no painel (Integrações › Segurança › Habilitar Split), no sandbox e na conta real.
- Na Railway, quando for ligar: `PAYMENT_PROVIDER=asaas`, `ASAAS_ENV=production`, `ASAAS_API_KEY` (só lá) e `ASAAS_WEBHOOK_TOKEN` (32 caracteres ou mais). O worker cadastra o webhook de pagamento e liga a Conta Escrow padrão (45 dias) ao iniciar.
- O Asaas exige o CPF de quem paga: a tela de pagamento pede o CPF, que vai direto ao Asaas e não é guardado.
- A Conta Escrow segura o dinheiro por no máximo 45 dias; por isso a agenda do professor abre no máximo 42 dias à frente (migração 0019).
- Tarifa da Conta Escrow, confirmada pelo chat do Asaas em 26/11: R$ 99,90 por mês na conta principal, a partir da primeira subconta ativa, e R$ 9,90 por mês por subconta ativa, mesmo sem cobranças. Vale para conta MEI. Como a subconta nasce quando o professor preenche o recebimento, a cobrança começa com o primeiro professor cadastrado em produção: só ligar o Asaas real no piloto. Professor que parar de dar aula deve ter a subconta desativada para não custar.

## Termos de uso e política de privacidade (27/11)

- Versão inicial escrita pelo agente a partir do código (`/termos` e `/privacidade`), sem revisão jurídica. O dono não tem verba para advogado agora: procurar revisão gratuita (Núcleo de Prática Jurídica de faculdade de Direito, Sebrae) e manter o piloto pequeno até lá.
- Identificação da empresa no rodapé: `COMPANY_LEGAL_NAME` e `COMPANY_CNPJ` já estão na Railway (27/11). `COMPANY_ADDRESS` foi tirado a pedido do dono, porque o endereço da MEI é a casa dele; na lista de espera não há venda, e o Decreto 7.962/2013 só pede o endereço físico de quem vende. **Antes de abrir as vendas, `COMPANY_ADDRESS` tem de voltar:** o endereço comercial, se o dono tiver contratado um (e trocado o da MEI), ou o de casa (Avenida Damasceno Vieira, 840, apto 91, Vila Mascote, São Paulo - SP, CEP 04363-040).
- Promessas do texto que dependem de rotina, não de código: confirmar que os registros de acesso (IP, data e hora) ficam 6 meses (Marco Civil, art. 15) na Railway ou guardá-los; apagar os documentos de verificação quando a conta do professor for encerrada; responder pedidos de titular em até 15 dias.
- Quem mudar uma regra (prazos, comissão, faltas) ou passar a usar outro fornecedor muda o texto das duas páginas.

## MEI e atividade da Reforce (27/11)

- A MEI foi aberta como "Professor(a) particular" porque o portal não tinha opção mais próxima; o dono não é professor. A Reforce intermedeia aulas entre famílias e professores, atividade que pode não caber no MEI. Antes de começar a faturar, perguntar ao Sebrae (gratuito) ou a um contador se precisa trocar a ocupação ou abrir uma ME.

