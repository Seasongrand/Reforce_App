# Reforce App: aulas particulares, Fase 1 (motor e professor)

Marketplace de aulas particulares para alunos do 6º ano ao ensino médio. A família reserva um horário real de um professor verificado e paga na plataforma; a parte do professor fica retida no provedor de pagamento e é liberada depois da aula.

Esta entrega é a **Fase 1** da especificação (`docs/produto-e-arquitetura.md`, seção 5):

- cadastro, perfil e verificação do professor, com painel interno de análise;
- agenda com regras semanais, bloqueios e serviços por modalidade (online, na casa do aluno, no endereço do professor), com intervalo de deslocamento;
- página pública do professor com link próprio e horários calculados ao vivo;
- reserva temporária de 10 minutos, pagamento por PIX e cartão, confirmação por webhook;
- confirmação e lembretes de 24 h e 1 h (WhatsApp e e-mail);
- sala de vídeo, código da aula presencial e repasse depois da aula.

Todos os provedores externos (pagamento, vídeo, WhatsApp, e-mail, calendário, arquivos, CEP) estão atrás de interfaces e rodam com **adaptadores falsos**. O que depende de você está em [`docs/pendencias.md`](docs/pendencias.md).

## Requisitos

- Node.js 22 ou superior
- Docker com Docker Compose (sobe o PostgreSQL 16)

## Rodar do zero

```bash
cp .env.example .env
```

No `.env`, troque `SESSION_SECRET` e `FILE_ENCRYPTION_KEY` (o comando para gerar está no próprio arquivo) e ponha o seu e-mail em `ADMIN_EMAILS`.

```bash
docker compose up -d
```

```bash
npm ci
```

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

Em dois terminais:

```bash
npm run dev
```

```bash
npm run worker
```

A aplicação fica em http://localhost:3000. O PostgreSQL do Compose escuta na porta **5433**, para não colidir com um PostgreSQL local.

## Roteiro com os adaptadores falsos

Nada sai da máquina: e-mails e mensagens de WhatsApp vão para a caixa de saída em **http://localhost:3000/dev**, onde também ficam o relógio ajustável e o botão que roda o worker na hora.

1. **Professor.** Em `/professor/entrar`, entre com qualquer e-mail; o código chega na caixa de saída do `/dev`. Preencha o perfil, envie a foto (JPG, PNG ou WEBP, em “Seu perfil”) e os três documentos (qualquer PDF ou imagem), abra a conta de recebimento (o CPF precisa ter dígitos válidos, como `529.982.247-25`) e envie para análise.
2. **Equipe.** Em `/interno/entrar`, entre com um e-mail de `ADMIN_EMAILS`. Em “Verificações”, compare a foto com o documento de identidade e aprove a foto, os três documentos e o perfil.
3. **Agenda.** De volta ao professor, crie um serviço em “Serviços” e horários em “Agenda”.
4. **Família.** Abra `/p/<endereço-da-página>`, escolha um horário, identifique-se (código no `/dev`), pague por PIX e use “Simular pagamento”.
5. **Aula.** No `/dev`, avance o relógio até perto da aula. O professor entra pela lista de “Aulas”; a família, pelo link do e-mail de confirmação. Os dois clicam “Entrar” na sala simulada.
6. **Minha conta.** Com a aula concluída, em `/conta` (entrada com o código do e-mail, sem senha), avalie a aula; a avaliação aparece no perfil e acende as estrelas na vitrine.
7. **Repasse.** Avance o relógio para depois do fim da aula e clique “Rodar varreduras agora”: a aula é concluída e o repasse fica retido. Avance mais 24 horas e rode de novo: o repasse é liberado.

## Testes

Os testes rodam contra **PostgreSQL real** (o do Compose), nunca contra simulação do banco.

| Comando | O que roda |
| --- | --- |
| `npm test` | Vitest: a tabela “Teste / Resultado” do apêndice, inclusive as 20 sessões simultâneas, e os serviços de domínio com os adaptadores falsos. Recria o banco `aulas_test` a cada execução. |
| `npm run check` | Verificação de tipos (`tsc`) e `npm test` |
| `npm run test:perf` | Volume com 2.000 professores sintéticos; imprime os tempos medidos |
| `npm run test:e2e` | Playwright: o fluxo completo no navegador, com web e worker reais, no banco `aulas_e2e` e na porta 3200 |

A integração contínua (`.github/workflows/ci.yml`, GitHub Actions) roda a verificação de tipos, `npm test`, o build de produção e `npm run test:e2e` em todo pull request e em todo push na `main`, com um PostgreSQL 16 de verdade.

Para o teste de ponta a ponta, o Chromium do Playwright precisa estar instalado (`npx playwright install chromium`, se a máquina ainda não tiver).

## Estrutura

```
db/migrations/      SQL puro. 0001 e 0002 são o apêndice, copiado literalmente
scripts/            migrate.ts (executor das migrações) e seed.ts (catálogo e equipe)
src/domain/         regras de negócio, sem tela: reserva, pagamento, aula, repasse, agenda, verificação
src/providers/      interfaces dos serviços externos e adaptadores falsos
src/worker/         Graphile Worker: fila, tarefas e varreduras agendadas
src/time/           relógio injetável e conversões de fuso com Temporal
src/app/            telas e rotas do Next.js (finas: chamam src/domain)
tests/db/           testes do apêndice
tests/domain/       testes dos serviços
tests/e2e/          fluxo completo no navegador
docs/               especificação, plano de implementação e pendências
```

## Onde estão as regras centrais

- **O banco decide a reserva.** A tabela `bookings` do apêndice, com `EXCLUDE USING gist` filtrado por estado (`db/migrations/0001_esquema_apendice.sql`). A aplicação trava por professor (`pg_advisory_xact_lock`), expira reservas vencidas no caminho, revalida e grava; `23P01` vira “horário ocupado” (`src/domain/booking/hold.ts`).
- **Disponibilidade é calculada.** A consulta de horários livres do apêndice, como função `free_slots` (`db/migrations/0003_free_slots.sql`).
- **Tempo.** Instantes em `timestamptz`; regras em dia da semana, hora local e fuso IANA; hora combinada (`local_start` + `timezone`) ao lado do instante. Hora local vira instante só no PostgreSQL; recorrência soma semanas na hora local (`src/time/`).
- **Idempotência.** Toda notificação entra primeiro em `webhook_events`; a confirmação é `UPDATE ... WHERE status = 'held'`; pagamento tardio tenta reocupar o horário ou devolve o valor (`src/domain/payment/webhook.ts`).
- **Repasse.** Um por aula, com a comissão congelada no pedido. Liberação com `FOR UPDATE SKIP LOCKED` e estado `releasing`; conciliação consulta a retenção antes de tentar de novo (`src/domain/payouts/`).
- **Relógio único.** Todo “agora” de regra de negócio vem de `Clock` e entra no SQL como parâmetro, o que permite o relógio ajustável do `/dev`.

## Trocar um adaptador falso pelo real

Cada serviço externo tem uma interface em `src/providers/<serviço>/types.ts`, e `src/providers/index.ts` escolhe o adaptador pela variável `*_PROVIDER`. Para plugar o Asaas, por exemplo: implemente `PaymentProvider` em `src/providers/payment/asaas.ts`, leia as credenciais do ambiente, ligue o adaptador em `providers()` e troque `PAYMENT_PROVIDER=asaas`. Escolher um adaptador real ainda não implementado falha na inicialização, com mensagem clara. Em produção (`NODE_ENV=production`), adaptador falso e `DEV_TOOLS=1` são recusados.

## Produção na Railway

O site roda na Railway, no projeto `bountiful-growth`: um serviço `Reforce_App` (este repositório) e um `Postgres`. Está no ar em https://reforce.up.railway.app, enquanto o domínio próprio não estiver pronto (veja `docs/pendencias.md`). A cada merge na `main`, a Railway faz o build, roda as migrações e a carga inicial antes de trocar a versão e só coloca no ar se `/api/saude` responder.

A configuração do deploy fica no próprio serviço, na Railway, e não no repositório. O arquivo `railway.json` (Config as Code) foi descontinuado pela Railway: serviços novos não o leem, e os antigos deixam de ler em 01/12/2026. O substituto (Infrastructure as Code, `.railway/railway.ts`) é aplicado pela linha de comando da Railway e não foi adotado.

**Enquanto não há provedores reais**, o site roda em `SITE_MODE=lista_de_espera`: a página inicial mostra a lista de espera de professores e todas as outras rotas respondem 404. A planilha das inscrições fica em `/api/lista-de-espera.csv` (hoje, https://reforce.up.railway.app/api/lista-de-espera.csv); o navegador pede a senha (`WAITLIST_EXPORT_PASSWORD`; o usuário pode ser qualquer um).

Configuração inicial, feita uma vez no painel da Railway:

1. **New Project → Deploy from GitHub repo** e escolha `Seasongrand/Reforce_App` (autorize o app da Railway no GitHub).
2. No projeto, **+ New → Database → PostgreSQL**.
3. No serviço do site, em **Variables**:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (referência ao banco criado no passo 2)
   - `SITE_MODE` = `lista_de_espera`
   - `APP_BASE_URL` = o endereço público do site. Hoje é `https://reforce.up.railway.app`; passa a ser `https://reforce.app.br` quando o domínio estiver pronto. O convite pelo WhatsApp, depois da inscrição, e a prévia do link usam este endereço.
   - `WAITLIST_EXPORT_PASSWORD` = uma senha sua, com 16 caracteres ou mais
   - `CONTACT_EMAIL` = um e-mail que exista, para pedidos sobre dados pessoais
4. Em **Settings → Deploy**, defina:
   - **Pre-deploy Command:** `npm run db:migrate && npm run db:seed`
   - **Custom Start Command:** `npm run start`
   - **Healthcheck Path:** `/api/saude` (tempo limite de 120 segundos)
5. Em **Settings → Networking**, clique em **Generate Domain** para ter um endereço `*.up.railway.app`. O nome pode ser trocado ali mesmo; o deste projeto é `reforce.up.railway.app`.
6. Ainda em **Networking**, adicione o domínio próprio `reforce.app.br`. No plano de teste, a Railway aceita um só domínio próprio por serviço; o `www` é redirecionado pelo Cloudflare. A Railway pede um CNAME na raiz, que o DNS do Registro.br não aceita, por isso o DNS do domínio fica no Cloudflare (gratuito):
   - CNAME `@` para o endereço que a Railway mostrar, com proxy ligado;
   - TXT `_railway-verify` com o valor que a Railway mostrar (sem ele, o domínio responde 404);
   - CNAME `www` para `reforce.app.br`, com proxy ligado;
   - **SSL/TLS** em **Full** (não “Full (strict)”, que não funciona com a Railway);
   - uma **Redirect Rule** do modelo “Redirect from WWW to root”;
   - no Registro.br, os servidores DNS trocados pelos dois que o Cloudflare indicar.

**Quando o marketplace abrir:** a página inicial vira a vitrine de busca para o aluno (resultados em `/buscar`), e a página dos professores, que também fica em `/professores` desde já, sai da página inicial. Troque `SITE_MODE` para `completo`, defina `SESSION_SECRET`, `FILE_ENCRYPTION_KEY` e as credenciais dos provedores reais, e crie um segundo serviço a partir do mesmo repositório para o worker, com o comando `npm run worker` e as mesmas variáveis.

## Produção (outras hospedagens)

Um contêiner web (`npm run build` e `npm start`) e um worker (`npm run worker`), com PostgreSQL 16+ gerenciado que ofereça `btree_gist`, `unaccent`, `cube` e `earthdistance`. Rode `npm run db:migrate` a cada deploy; o executor usa trava e é idempotente.
