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

1. **Professor.** Em `/professor/entrar`, entre com qualquer e-mail; o código chega na caixa de saída do `/dev`. Preencha o perfil, envie os três documentos (qualquer PDF ou imagem), abra a conta de recebimento (o CPF precisa ter dígitos válidos, como `529.982.247-25`) e envie para análise.
2. **Equipe.** Em `/interno/entrar`, entre com um e-mail de `ADMIN_EMAILS`. Em “Verificações”, abra os documentos, aprove os três e o perfil.
3. **Agenda.** De volta ao professor, crie um serviço em “Serviços” e horários em “Agenda”.
4. **Família.** Abra `/p/<endereço-da-página>`, escolha um horário, identifique-se (código no `/dev`), pague por PIX e use “Simular pagamento”.
5. **Aula.** No `/dev`, avance o relógio até perto da aula. O professor entra pela lista de “Aulas”; a família, pelo link do e-mail de confirmação. Os dois clicam “Entrar” na sala simulada.
6. **Repasse.** Avance o relógio para depois do fim da aula e clique “Rodar varreduras agora”: a aula é concluída e o repasse fica retido. Avance mais 24 horas e rode de novo: o repasse é liberado.

## Testes

Os testes rodam contra **PostgreSQL real** (o do Compose), nunca contra simulação do banco.

| Comando | O que roda |
| --- | --- |
| `npm test` | Vitest: a tabela “Teste / Resultado” do apêndice, inclusive as 20 sessões simultâneas, e os serviços de domínio com os adaptadores falsos. Recria o banco `aulas_test` a cada execução. |
| `npm run check` | Verificação de tipos (`tsc`) e `npm test` |
| `npm run test:perf` | Volume com 2.000 professores sintéticos; imprime os tempos medidos |
| `npm run test:e2e` | Playwright: o fluxo completo no navegador, com web e worker reais, no banco `aulas_e2e` e na porta 3200 |

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

## Produção

Um contêiner web (`npm run build` e `npm start`) e um worker (`npm run worker`), com PostgreSQL 16+ gerenciado que ofereça `btree_gist`, `unaccent`, `cube` e `earthdistance`. Rode `npm run db:migrate` a cada deploy; o executor usa trava e é idempotente.
