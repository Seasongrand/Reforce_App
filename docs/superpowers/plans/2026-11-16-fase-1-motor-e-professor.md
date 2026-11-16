# Fase 1 — Motor e professor: plano de implementação

> **Para quem executa:** use superpowers:executing-plans (ou superpowers:subagent-driven-development) etapa por etapa. Os passos usam caixas `- [ ]`.

**Objetivo:** entregar o motor de reservas com pagamento retido, o lado do professor (cadastro, verificação, agenda, página pública) e o ciclo da aula até o repasse, rodando de ponta a ponta com adaptadores falsos.

**Arquitetura:** um monólito Next.js (web + API + webhooks + painéis) e um processo worker (Graphile Worker), ambos falando com um único PostgreSQL 16. A garantia contra reserva dupla é a restrição `EXCLUDE` da tabela `bookings`. Disponibilidade é a função SQL `free_slots`, calculada a cada consulta. Todo serviço externo fica atrás de uma interface, com adaptador falso para desenvolvimento e testes.

**Stack:** Node 22, Next.js 16 (App Router) + TypeScript, PostgreSQL 16 (`btree_gist`, `unaccent`, `cube`, `earthdistance`), Kysely + `pg` (tipos gerados com `kysely-codegen`), migrações em SQL puro com executor próprio, `temporal-polyfill`, Graphile Worker, Zod, `libphonenumber-js`, Tailwind 4, Vitest (integração contra PostgreSQL real), Playwright (ponta a ponta), Docker Compose (só o banco).

**Especificação:** `docs/produto-e-arquitetura.md` (fonte da verdade). Este plano cita seções dela como §2.4, §2.6 etc.

## Restrições globais

Valem para todas as etapas.

1. **O banco decide a reserva.** `bookings` exatamente como no apêndice (tabela base + `ALTER` dos acréscimos), com `no_double_booking EXCLUDE USING gist (teacher_id WITH =, blocked WITH &&) WHERE (status IN ('held','confirmed'))`. Nada de checagem só na aplicação nem trava em Redis.
2. **Tempo.** Instantes em `timestamptz`. Regras em dia ISO (1 = segunda) + `time` local + fuso IANA. Hora combinada em `local_start timestamp` + `timezone`. Hora local vira instante **num lugar só: o PostgreSQL** (`local_start AT TIME ZONE timezone`). Recorrência soma semanas em `Temporal.PlainDateTime`, nunca 168 h. Nenhum `Date` em regra de negócio, só `Temporal`.
3. **Disponibilidade calculada.** A consulta de horários livres do apêndice, embrulhada em `free_slots(teacher, service, from, to, now)`, é a única fonte de horários.
4. **Reserva em uma transação:** `pg_advisory_xact_lock(hashtextextended('teacher:' || id, 0))`, depois expira as `held` vencidas no caminho, revalida (antecedência, janela, limite diário, horário na grade) e faz o `INSERT`. `23P01` significa “horário ocupado”.
5. **Idempotência.** Webhook entra primeiro em `webhook_events` (`ON CONFLICT DO NOTHING`). Confirmação: `UPDATE bookings ... WHERE order_id = $1 AND status = 'held'`. Pagamento tardio tenta reocupar o horário; se não der, devolve o valor. Pedido com `idempotency_key` única.
6. **Repasse.** Um por aula (`payouts.booking_id` único), com comissão congelada no pedido no momento da reserva. Liberação pela consulta da §2.6 (`FOR UPDATE SKIP LOCKED`, estado `releasing`). Só depois o estado vira `released`, com `WHERE status = 'releasing'`.
7. **Provedores atrás de interfaces**, cada um com adaptador falso: pagamento, vídeo, WhatsApp, e-mail, calendário, além de arquivos privados e geocodificação.
8. **Menores.** Aluno sem login. Nenhum canal entre professor e aluno. Endereço visível ao professor só com a aula em `confirmed`/`completed`/`no_show`. Documentos de verificação fora do banco, em armazenamento cifrado, acessados por link temporário.
9. **Segredos só em variáveis de ambiente**, com `.env.example` completo.
10. **Valores sugeridos pela especificação viram configuração**, em `src/config.ts`, lida do ambiente com padrão. Cada um vai também para `docs/pendencias.md`:
    - `HOLD_MINUTES=10`
    - `PIX_EXPIRY_LEAD_MINUTES=1`
    - `COMMISSION_MARKETPLACE_BPS=1500`
    - `COMMISSION_TEACHER_LINK_BPS=500`
    - `DISPUTE_WINDOW_HOURS=24`
    - `TEACHER_NO_SHOW_MINUTES=15`
    - `CRIMINAL_RECORD_VALIDITY_MONTHS=6`
    - `CALENDAR_FREEBUSY_TIMEOUT_MS=2000`
    - padrões do professor do apêndice: `min_notice_min=120`, `horizon_days=60`, `slot_step_min=30`
11. **Relógio único.** Todo “agora” de regra de negócio vem de `Clock.now(): Temporal.Instant` e entra no SQL como parâmetro `$now`, como `:'now'` no apêndice. Em produção, o relógio é o do sistema. Com `DEV_TOOLS=1`, um relógio ajustável permite simular a passagem do tempo no teste de ponta a ponta. `DEFAULT now()` só em colunas de auditoria.
12. **Idioma.** Interface e mensagens em português do Brasil, valores em reais (centavos em `int`).

## Foco da revisão

Cinco situações que a especificação implica e que nenhum teste do apêndice cobre. Cada uma tem teste na etapa indicada.

1. **Responsável em outro fuso** (Manaus vendo professor de São Paulo, horário das 23h30). A lista agrupa pelo dia de quem vê, e a confirmação cita os dois horários. Teste na Etapa 6 (`zoned.test.ts`) e na Etapa 10 (modelos).
2. **Telefone digitado em formatos diferentes** (`(11) 98888-7777`, `+55 11 988887777`). Deve dar o mesmo `phone_e164`, e um telefone já cadastrado nunca troca de dono sem o código enviado ao e-mail que já está na conta. Teste na Etapa 12.
3. **Clique duplo ou repetição de “reservar”** com a mesma chave. Volta o mesmo pedido, sem segunda reserva. Teste na Etapa 8.
4. **PIX pago no último segundo da reserva temporária.** O QR expira 1 minuto antes da reserva, então o pagamento sempre a encontra em `held`. Notificação que chega antes do registro da cobrança fica guardada e é reprocessada. Teste na Etapa 9.
5. **Professor consulta a aula antes do pagamento.** Não vê o endereço da família nem o telefone. Teste na Etapa 11 (consulta do painel do professor).

---

## Estrutura de arquivos

```
docker-compose.yml           PostgreSQL 16 (porta 5433), volume, healthcheck
.env.example                 todas as variáveis, sem valores secretos
package.json                 scripts: dev, worker, db:migrate, db:seed, db:types, test, test:perf, test:e2e
db/migrations/0001_esquema_apendice.sql       apêndice "Esquema", literal
db/migrations/0002_acrescimos_marketplace.sql apêndice "Acréscimos do marketplace", literal
db/migrations/0003_funcoes.sql                free_slots, refresh_next_slot, refresh_teacher_search
db/migrations/0004_fase1.sql                  acréscimos da Fase 1 (lista na Etapa 6)
db/migrations/0005_dev.sql                    tabelas dev_* dos adaptadores falsos
scripts/migrate.ts  scripts/seed.ts
src/config.ts                 env validado com Zod
src/db/{client.ts,types.ts,errors.ts,tx.ts}
src/time/{clock.ts,zoned.ts}
src/providers/{payment,video,whatsapp,email,calendar,storage,geocoding}/{types.ts,fake.ts,index.ts}
src/domain/availability.ts
src/domain/booking/{hold.ts,errors.ts}
src/domain/payment/{charge.ts,webhook.ts,late-payment.ts}
src/domain/notifications/{schedule.ts,templates.ts,send.ts}
src/domain/lessons/{room.ts,checkin.ts,presence.ts,close.ts}
src/domain/payouts/{create.ts,release.ts,reconcile.ts}
src/domain/teachers/{profile.ts,verification.ts,payment-account.ts,schedule.ts,listing.ts}
src/domain/guardians/identify.ts
src/domain/auth/{codes.ts,sessions.ts}
src/domain/sweeps.ts          todas as varreduras como funções puras (deps, now)
src/worker/index.ts           Graphile Worker: crontab + tarefas
src/app/...                   telas e rotas (Etapas 12 a 17)
tests/helpers/{db.ts,fixtures.ts,concurrency.ts}
tests/db/*.test.ts            tabela "Teste / Resultado" do apêndice
tests/domain/*.test.ts        serviços com adaptadores falsos
tests/e2e/fluxo-completo.spec.ts
docs/pendencias.md  README.md
```

**Banco de teste.** Um `globalSetup` do Vitest recria o banco `aulas_test` no PostgreSQL do Compose e aplica as migrações. Os arquivos de teste rodam em sequência (`fileParallelism: false`) e cada um faz `TRUNCATE ... CASCADE` no `beforeEach`. Os testes de concorrência abrem conexões `pg.Client` separadas, sem transação envolvendo o teste, porque precisam de dados gravados de verdade.

---

## Parte A — Banco de dados e testes do apêndice

### Etapa 0: Fundação do repositório

**Entrega:** `git init`; `package.json` com TypeScript estrito; `docker-compose.yml`; `.env.example`; `.gitignore` (`node_modules`, `.env`, `.next`, `var/`); executor de migrações; Vitest configurado com banco de teste.

**Interfaces produzidas:**
- `npm run db:migrate`: aplica `db/migrations/*.sql` em ordem, cada arquivo numa transação, sob `pg_advisory_lock`. Registra em `schema_migrations(version text primary key, applied_at timestamptz)`. Também instala o esquema do Graphile Worker.
- `tests/helpers/db.ts`: `testPool()`, `truncateAll()`, `newClient(): Promise<pg.Client>`.

- [ ] Teste `tests/db/smoke.test.ts`: “migrações criam as quatro extensões”. `SELECT extname FROM pg_extension` contém `btree_gist`, `unaccent`, `cube`, `earthdistance`, e `SHOW server_version_num` ≥ 160000.
- [ ] Teste: rodar `db:migrate` duas vezes não falha e não reaplica nada.
- [ ] Verificação: `docker compose up -d && npm run db:migrate && npm test` passa num banco vazio.
- [ ] Commit `chore: fundação do repositório, compose e migrações`.

### Etapa 1: Esquema do apêndice e restrições

**Entrega:** `0001` e `0002` copiados literalmente do apêndice. `0003` com:
- `free_slots(p_teacher uuid, p_service uuid, p_from date, p_to date, p_now timestamptz) RETURNS SETOF timestamptz`, com o corpo igual à consulta “Horários livres”;
- `refresh_next_slot`, igual ao apêndice, com um ajuste descrito em “Desvios”;
- `refresh_teacher_search(p_teacher uuid)`, que monta `doc` com `to_tsvector('portuguese', unaccent(nome ‖ chamada ‖ bio ‖ disciplinas))`, `subject_ids`, `grade_ids`, notas de `reviews` publicadas e local/raio de `teachers`.

**Testes** (`tests/db/constraints.test.ts`), um por linha do apêndice:

| Teste | Afirmação |
| --- | --- |
| duas aulas sobrepostas | o segundo `INSERT` falha com `code === '23P01'` |
| intervalo de 10 min | depois de aula 14h–15h com `buffer_after=10`, 15h00 falha com `23P01` e 15h10 grava |
| coluna gerada `timestamptz - interval` | `ALTER TABLE bookings ADD COLUMN x tstzrange GENERATED ALWAYS AS (tstzrange(starts_at - interval '10 min', ends_at)) STORED` falha com mensagem contendo `generation expression is not immutable` |
| `unaccent` em índice de expressão | `CREATE INDEX ... (to_tsvector('portuguese', unaccent(...)))` falha com `42P17` |
| aula na casa do aluno sem endereço | `INSERT` com `modality='at_student'` e `address_id NULL` falha com `23514` |
| segundo repasse da mesma aula | `23505` |
| repasse com partes que não somam o total | `23514` |
| origem registrada duas vezes | `teacher_link` e depois `marketplace` com `ON CONFLICT DO NOTHING`: fica `teacher_link` |
| mensagem sem vínculo | `23503` |
| avaliação: segunda, de outro responsável, de aula não concluída | o `INSERT ... RETURNING id` do apêndice devolve 0 linhas nos três casos e 1 linha no caso válido |
| confirmação repetida | `UPDATE ... WHERE status='held'` altera 1 linha e depois 0 |
| notificação de pagamento repetida | dois `INSERT ... ON CONFLICT DO NOTHING RETURNING id`: 1 linha e depois 0; `count(*) = 1` |

- [ ] Escrever os testes. Eles falham porque não há tabelas.
- [ ] Criar `0001`, `0002` e `0003`. Os testes passam.
- [ ] Commit `feat(db): esquema do apêndice com restrições e testes`.

### Etapa 2: Tempo e horários livres

**Testes** (`tests/db/time-and-slots.test.ts`, mais `tests/domain/recurrence.test.ts` para o lado Temporal):

- **Hora local + 7 dias contra instante + 168 h (regras de 2018).** `'2018-10-30 14:00'` em `America/Sao_Paulo` é `17:00Z`. A mesma hora local 7 dias depois é `2018-11-06 16:00Z` (14h locais). O instante + 168 h é `17:00Z`, que dá 15h locais. Verificado no SQL e com `Temporal.PlainDateTime.add({weeks: 1})`.
- **Conciliação.** A consulta da §2.1 não devolve nada com dados coerentes. Depois de um `UPDATE` que desloca `starts_at` em 1 h, devolve a aula.
- **8 horários esperados.** Professor em São Paulo; serviço de 60 min, grade de 30, sem intervalo. Regras: terça 14h–18h e quinta 9h–12h. Aula paga na terça 17/11/2026, 14h–15h. Compromisso externo na mesma terça, 16h30–17h. Bloqueio de dia inteiro na terça 24/11. Consulta de 16/11 a 24/11 com `now = 16/11 08:00`. Resultado exato:
  - terça 17/11: 15h00, 15h30, 17h00;
  - quinta 19/11: 9h00, 9h30, 10h00, 10h30, 11h00;
  - nenhum horário em 24/11.
- **Antecedência de 2 h, consulta às 15h.** Regra de terça 14h–18h, `now = terça 15:00`: o primeiro horário é 17h00.
- **Presencial com 30 min de deslocamento.** Depois de aula online das 14h às 15h, com 10 min de intervalo (bloqueia até 15h10):
  - `free_slots` do serviço presencial (60 min, 30 antes e 30 depois) não traz 15h30 e traz 16h00;
  - o `INSERT` às 15h30 falha com `23P01`;
  - com a presencial das 16h gravada, a próxima presencial oferecida é 18h00.

- [ ] Escrever os testes, implementar o que faltar e chegar ao verde.
- [ ] Commit `test(db): fuso, recorrência e horários livres do apêndice`.

### Etapa 3: Concorrência da reserva em SQL

**Interfaces produzidas:** `tests/helpers/concurrency.ts` com `raceN(n, fn: (client) => Promise<T>): Promise<Settled<T>[]>`. Cada função roda numa conexão própria e todas esperam uma barreira antes do `INSERT`.

**Testes** (`tests/db/concurrency.test.ts`):
- **20 sessões só com a restrição.** Exatamente 1 sucesso e 19 rejeições com `23P01`. Depois, `count(*)` de `held`/`confirmed` no intervalo é 1.
- **20 sessões com trava e verificação prévia**, usando o SQL do apêndice: trava, `UPDATE ... expired`, `SELECT EXISTS` de sobreposição e só então `INSERT`. Resultado: 1 grava, 19 devolvem `'ocupado'` e nenhuma dá erro.
- **Reserva temporária vencida.** Uma `held` com `hold_expires_at` no passado ainda faz o `INSERT` direto falhar com `23P01`. Na transação completa, o passo de limpeza a torna `expired` e o novo `INSERT` grava.
- **Pacote de 4 semanas com conflito na terceira.** As datas vêm de `PlainDateTime.add({weeks: k})`, numa transação só. Resultado: `23P01` e nenhuma aula do pacote gravada (`count = 0` para o `order_id`).

- [ ] Testes e commit `test(db): concorrência da reserva (apêndice §2.4)`.

### Etapa 4: Repasse

**Testes** (`tests/db/payouts.test.ts`). A consulta é a da §2.6, com `$now` e `LIMIT` como parâmetros.
- **Dois processos ao mesmo tempo.** São 6 repasses: 4 vencidos, 1 vencido com disputa aberta e 1 ainda não vencido.
  - A transação A pega com `LIMIT 3` e não faz commit; a transação B pega com `LIMIT 50`. Resultado: A tem 3, B tem 1, e a interseção é vazia.
  - Depois dos dois commits, o disputado e o não vencido continuam `held`.
- **Liberação repetida.** `UPDATE payouts SET status='released' ... WHERE id=$1 AND status='releasing'` altera 1 linha e depois 0.
- **Comissão congelada.** `splitCommission(12100, 1500)` dá `{platform: 1815, teacher: 10285}`, e a linha grava com o `CHECK` satisfeito. Arredondamento: comissão da plataforma arredondada meio para cima, professor fica com o resto. `splitCommission(9999, 1500)` dá `{platform: 1500, teacher: 8499}`.

- [ ] Testes, `src/domain/payouts/split.ts` (`splitCommission(grossCents: number, bps: number): {platform: number; teacher: number}`) e commit.

### Etapa 5: Busca e retrato, só SQL (sem tela)

A busca pública está fora da Fase 1, mas os testes do apêndice que dependem dela entram. Implemento as funções e as consultas, sem interface.

**Testes** (`tests/db/search.test.ts`):
- **Filtros e verificação.** Matemática, 9º ano, online, preço máximo: voltam os 2 professores esperados. A professora aprovada com certidão vencida (`valid_until` ontem) fica fora.
- **Média bayesiana.** 40 avaliações com soma 192 dão `4.77`. Uma avaliação nota 5 dá `4.58`. A primeira vem antes na ordenação.
- **Texto sem acento.** Com a bio contendo “Recuperação”, `q = 'recuperacao'` encontra o professor.
- **Distância.** Coordenadas geradas a 2,9 km e a 10,1 km do ponto da família, conferidas com `earth_distance`. Com raio de 5 km, a de 2,9 km aparece e a de 10,1 km não. Com raio de 12 km, a de 10,1 km aparece.
- **Retrato desatualizado.**
  - O retrato aponta 14h.
  - Uma aula 14h–15h com `buffer_after = 10` é vendida.
  - Uma segunda reserva às 14h, feita a partir do retrato velho, falha com `23P01`.
  - `refresh_next_slot` passa o próximo horário para 15h30.
- **Volume** (`npm run test:perf`, fora do `npm test`). Com 2.000 professores sintéticos:
  - mediana de 20 buscas abaixo de 50 ms;
  - os 2.000 `refresh_next_slot` abaixo de 10 s.
  - O teste imprime os números medidos. O documento cita 6 ms e 1,3 s numa máquina específica, então uso limites folgados e registro o resultado.

- [ ] Testes e commit `test(db): busca, nota, distância e retrato (apêndice §2.5)`.

**Fim da Parte A:** toda a tabela “Teste / Resultado” do apêndice passa contra PostgreSQL real.

---

## Parte B — Núcleo da aplicação (serviços, sem telas)

### Etapa 6: Acréscimos da Fase 1, configuração, Kysely e tempo

**Migração `0004_fase1.sql`**, só acréscimos e sem tocar em `bookings`:

| Item | Por quê |
| --- | --- |
| `teachers`: `email text UNIQUE`, `phone_e164 text`, `whatsapp_opt_in_at timestamptz`, `base_cep text`, `teaching_address text` | login do professor, aviso por WhatsApp e endereço da aula “no endereço do professor”, que a família só vê depois do pagamento. O esquema guarda só o centro do CEP |
| `orders.commission_bps int NOT NULL` | comissão congelada na reserva (§2.2: “preço e comissão congelam na compra”) |
| `payments.checkout_data jsonb` | QR/copia-e-cola do PIX ou link do cartão devolvidos pelo provedor |
| `payouts.release_attempted_at timestamptz` | conciliar repasse parado em `releasing` (§2.6: consultar a retenção antes de tentar de novo) |
| `teacher_verifications`: `decision_note text`, `decided_by uuid` | motivo da recusa mostrado ao professor; auditoria |
| `teacher_payment_accounts(teacher_id pk, provider, provider_account_id, wallet_id, status, created_at)` | conta de recebimento (subconta). CPF e dados bancários vão direto ao provedor e não ficam no banco |
| `calendar_connections` (§2.2) | conta conectada, token cifrado, calendários que bloqueiam e o calendário “Aulas” |
| `booking_events` (§2.2) + gatilho `AFTER INSERT OR UPDATE OF status ON bookings` | histórico de estados, inclusive das varreduras |
| `staff_users(id, email unique, name)` | acesso ao painel interno |
| `auth_codes(id, purpose, destination, code_hash, expires_at, attempts, consumed_at, created_at)` | login sem senha por código |
| `sessions(id, token_hash unique, subject_type check in ('teacher','guardian','staff'), subject_id, expires_at, created_at)` | sessões |

`credits` (§2.2) fica de fora. O formato dela depende da regra de cancelamento, que ainda está pendente, e vai para `docs/pendencias.md`.

**Interfaces produzidas:**
- `src/config.ts`: `config` tipado e validado com Zod, que falha na inicialização se faltar algo. Inclui os valores da restrição global 10 e `PROVIDER_*=fake|...`.
- `src/db/client.ts`: `db: Kysely<DB>`, `pool`. `src/db/tx.ts`: `withTx<T>(fn: (trx) => Promise<T>): Promise<T>`.
- `src/db/errors.ts`: `isExclusionViolation(e)`, que testa `23P01`, e `isUniqueViolation(e)`, que testa `23505`.
- `src/time/clock.ts`: `interface Clock { now(): Temporal.Instant }`, com `systemClock` e `devClock`. O `devClock` lê o deslocamento em `dev_clock` e só existe com `DEV_TOOLS=1`; em produção a aplicação recusa iniciar com `DEV_TOOLS=1`.
- `src/time/zoned.ts`:
  - `toLocal(instant, tz): Temporal.PlainDateTime`;
  - `groupByViewerDate(slots: Temporal.Instant[], viewerTz): Map<string /*yyyy-mm-dd*/, Temporal.Instant[]>`;
  - `formatPtBr(instant, tz): string`;
  - `bothTimes(instant, teacherTz, viewerTz): string`, que devolve um horário só quando os fusos coincidem.

**Testes** (`tests/domain/zoned.test.ts`): um horário às 23h30 em `America/Manaus` cai em `00:30` do dia seguinte para `America/Sao_Paulo` e é agrupado nesse dia (foco da revisão 1). `bothTimes` cita os dois horários quando os fusos diferem.

- [ ] Migração, `npm run db:types` (gera `src/db/types.ts`), testes e commit.

### Etapa 7: Interfaces de provedores e adaptadores falsos

**Migração `0005_dev.sql`:** `dev_clock`, `dev_outbox` (mensagens “enviadas”), `dev_provider_calls` (chamadas registradas: provedor, operação, referência, conteúdo) e `dev_calendar_busy`.

**Interfaces produzidas.** Em cada `types.ts`, todas as operações são assíncronas.
- `PaymentProvider`. As cinco operações da §3.4 e mais duas que o fluxo exige:
  - `createRecipientAccount(input): {accountId, walletId}` (subconta do professor, §1 passo 4);
  - `createCharge({orderId, method:'pix'|'card', amountCents, split:{walletId, fixedCents}, escrow:true, expiresAt, payer}): {providerChargeId, checkoutData}`;
  - `cancelCharge(chargeId)`;
  - `refund(chargeId, amountCents?)`;
  - `releaseEscrow(chargeId): {status:'released'|'pending'}`;
  - `getEscrow(chargeId): {status:'held'|'released'|'refunded'}`, para conciliar, porque o Asaas não avisa a liberação;
  - `parseWebhook(headers, rawBody): {eventId, type:'payment.paid'|'payment.refunded'|'payment.failed', chargeId, raw}`, que lança erro se a assinatura não bater.
- `VideoProvider`:
  - `createRoom({bookingId, startsAt, endsAt}): {roomName}`;
  - `issueAccess({roomName, role:'teacher'|'student'|'observer', displayName, validFrom, validUntil}): {joinUrl}`;
  - `parsePresenceWebhook(headers, rawBody): {eventId, roomName, role, kind:'joined'|'left', at}[]`.
- `WhatsAppSender` e `EmailSender`: `send({to, template, vars}): {providerMessageId}`.
- `CalendarProvider`:
  - `freeBusy(conn, range): Interval[]`;
  - `createEvent(conn, lesson): {eventId}`;
  - `deleteEvent(conn, eventId)`.
- `FileStorage`:
  - `put(key, bytes, contentType)`, que cifra com AES-256-GCM usando a chave `FILE_ENCRYPTION_KEY` e grava em `var/private/`;
  - `signedUrl(key, ttlSeconds)`;
  - `delete(key)`.
- `Geocoder`: `cepToLatLng(cep): {lat, lng} | null`. O falso usa uma tabela fixa de CEPs de teste.
- `src/providers/index.ts`: `providers()`, que escolhe o adaptador pela variável `PROVIDER_*`. Os reais lançam “não configurado” até que você forneça as credenciais.

O que cada falso faz:
- registra cada chamada em `dev_provider_calls`;
- envios vão para `dev_outbox`;
- o pagamento falso assina webhooks com HMAC (`FAKE_WEBHOOK_SECRET`);
- `releaseEscrow` falha de propósito quando `FAKE_PAYMENT_FAIL=release`, para testar a conciliação.

**Testes** (`tests/domain/providers-fake.test.ts`):
- webhook falso com assinatura errada é recusado;
- arquivo gravado não contém o texto original em claro e volta igual pela leitura;
- link assinado vencido é recusado.

- [ ] Testes, implementação e commit `feat: interfaces de provedores com adaptadores falsos`.

### Etapa 8: Reserva temporária e cobrança

**Interfaces produzidas** (`src/domain/booking/hold.ts`):

```ts
type HoldRequest = { teacherId: string; serviceId: string; studentId: string; guardianId: string;
  addressId?: string; startsAt: Temporal.Instant[] /* 1 na Fase 1; N só no teste de pacote */;
  idempotencyKey: string };
type HoldResult =
  | { ok: true; orderId: string; bookingIds: string[]; holdExpiresAt: Temporal.Instant }
  | { ok: false; reason: 'ocupado' | 'indisponivel' | 'antecedencia' | 'limite_diario' | 'professor_indisponivel' | 'fora_do_raio';
      alternatives: Temporal.Instant[] /* até 5 horários livres mais próximos */ };
function holdSlots(deps, req: HoldRequest, now: Temporal.Instant): Promise<HoldResult>;
```

Ordem de execução:
1. **Fora da transação:** livre/ocupado do calendário com limite de 2 s, gravado em `external_busy` para a janela consultada. Se falhar, segue com o último dado conhecido e avisa o professor.
2. **Na transação:**
   1. trava do professor;
   2. `UPDATE ... 'expired'` no caminho;
   3. professor em `teachers_listed`, com conta de recebimento ativa e serviço ativo;
   4. cada `startsAt` convertido em `local_start` com Temporal e reconvertido pelo PostgreSQL. Precisa estar em `free_slots` daquele dia: se não estiver e houver sobreposição ativa, `ocupado`; senão, `indisponivel`;
   5. limite diário contado por dia local do professor;
   6. `INSERT orders` com `commission_bps` pela origem em `teacher_guardian_links`;
   7. `INSERT bookings` com o SQL do apêndice.

`23P01` é capturado e vira `ocupado`. Repetição com a mesma `idempotency_key` devolve o pedido existente.

`src/domain/payment/charge.ts`: `startPayment(deps, orderId, method, now): {paymentId, checkoutData, expiresAt}`.
- Cria a cobrança com `expiresAt = hold_expires_at − PIX_EXPIRY_LEAD_MINUTES`.
- O split dá ao professor um valor fixo calculado sobre o preço cheio (§3.4).
- Trocar de método cancela a cobrança anterior.

**Testes** (`tests/domain/hold.test.ts`):
- 20 chamadas simultâneas de `holdSlots` no mesmo horário: 1 `ok` e 19 `ocupado`, sem exceção, e `count = 1` no banco;
- mesma `idempotencyKey` duas vezes: mesmo `orderId` e 1 reserva (foco 3);
- horário fora da grade, como 14h10 numa grade de 30, dá `indisponivel`;
- antecedência ferida dá `antecedencia`;
- limite diário 1 com uma aula no dia dá `limite_diario`;
- professor com certidão vencida dá `professor_indisponivel`;
- pacote de 4 semanas com conflito na 3ª pelo serviço: `ocupado` e nada gravado;
- `ocupado` traz `alternatives` não vazias e todas presentes em `free_slots`;
- mudar preço e duração do serviço depois da reserva não altera o pedido nem a aula;
- `startPayment` grava `payments.platform_fee_cents` e `expires_at = hold − 1 min`.

- [ ] Testes, implementação e commit `feat: reserva temporária com trava, revalidação e cobrança`.

### Etapa 9: Webhook de pagamento, pagamento tardio e expiração

**Interfaces produzidas:**
- `src/domain/payment/webhook.ts`: `handlePaymentWebhook(deps, headers, rawBody, now): {status: 'processed'|'duplicate'|'deferred'}`.
  1. Grava em `webhook_events`, num commit próprio, com `ON CONFLICT DO NOTHING`.
  2. Processa numa transação que trava o evento (`FOR UPDATE ... WHERE processed_at IS NULL`).
  3. `payment.paid`:
     - `payments` passa a `paid`;
     - `UPDATE bookings ... WHERE status='held'`;
     - se alterou linhas: `orders` passa a `paid`, cria `lesson_sessions` com `checkin_code_hash` nas aulas presenciais e grava as `notifications` (Etapa 10);
     - ainda na mesma transação, enfileira as tarefas `video.create_room` e `calendar.create_event` com `graphile_worker.add_job`;
     - se não alterou linhas, segue o caminho do pagamento tardio;
     - no fim, grava `processed_at`.
  4. Cobrança ainda desconhecida: o evento fica sem processar (`deferred`) e a varredura o tenta de novo.
- `src/domain/payment/late-payment.ts`: com trava, `UPDATE bookings SET status='confirmed', hold_expires_at=NULL WHERE order_id=$1 AND status='expired'`.
  - Se der `23P01`, o pedido passa a `refunded`, entra a tarefa `payment.refund` (que chama `PaymentProvider.refund`) e a notificação `pagamento_tardio_reembolso`, com link para a página do professor.
- `src/domain/sweeps.ts`:
  - `expireHolds(deps, now)`: `held` vencidas passam a `expired`, o pedido passa a `expired` e as cobranças pendentes são canceladas e passam a `expired`;
  - `retryDeferredWebhooks(deps, now)`.

**Testes** (`tests/domain/payment-webhook.test.ts`):
- o mesmo evento duas vezes dá `processed` e depois `duplicate`, com 1 linha em `webhook_events`, aula `confirmed` e notificações gravadas uma vez só;
- pagamento a 1 s do fim da reserva confirma, porque o QR vence antes da reserva (foco 4);
- pagamento depois de `expireHolds`, com horário livre: a aula é reocupada como `confirmed`;
- pagamento tardio com o horário vendido a outra família: pedido `refunded` e uma chamada `refund` em `dev_provider_calls`;
- evento que chega antes do registro em `payments` fica `deferred` e é processado depois pela varredura;
- assinatura inválida dá 401 e não grava nada;
- `expireHolds` cancela a cobrança no provedor falso.

- [ ] Testes, implementação e commit `feat: confirmação idempotente, pagamento tardio e expiração`.

### Etapa 10: Notificações e worker

**Interfaces produzidas:**
- `src/domain/notifications/schedule.ts`: `scheduleForConfirmedBooking(trx, bookingId, now)`, chamada dentro da transação de confirmação.
  - **Família:**
    - modelos `confirmacao_responsavel` (agora), `lembrete_24h_responsavel` e `lembrete_1h_responsavel`;
    - WhatsApp só com `whatsapp_opt_in_at`; e-mail sempre, como cópia;
    - lembrete cujo horário já passou não é criado.
  - **Professor:** `confirmacao_professor` por WhatsApp e e-mail.
  - O destinatário sai do nome do modelo, sem mudar o esquema de `notifications`.
- `templates.ts`: `render(template, ctx): {whatsapp: {name, vars}, email: {subject, text}}`. O texto é estritamente transacional (§3.5) e cita os dois horários quando os fusos diferem.
  - Online: a mensagem leva o link da sala.
  - Presencial: leva o código da aula e, para a família de aula “no endereço do professor”, o endereço do professor.
- `send.ts`: `sendDueNotifications(deps, now)`.
  - Seleciona as vencidas com `FOR UPDATE SKIP LOCKED LIMIT 50`.
  - Cancela as de aula que não está mais `confirmed`.
  - Envia e marca `sent` ou `failed`.
- `src/worker/index.ts`, com o crontab do Graphile Worker de minuto em minuto:
  - `expireHolds`, `sendDueNotifications`, `retryDeferredWebhooks`, `closeLessons`, `releaseDuePayouts`, `reconcileReleasing`;
  - todo dia: `expireVerifications`;
  - refazer o retrato da busca quando uma aula muda de estado ou a agenda muda;
  - tarefas avulsas: `video.create_room`, `calendar.create_event` (grava `bookings.external_event_id`) e `payment.refund`.
  - Cada tarefa chama a função pura de `sweeps.ts` com `clock.now()`.

**Testes** (`tests/domain/notifications.test.ts`):
- confirmação 3 dias antes da aula: 3 modelos da família × 2 canais (com aceite) + 2 do professor = 8 linhas;
- sem aceite de WhatsApp, 3 + 2 = 5 linhas;
- aula daqui a 5 h: o lembrete de 24 h não existe;
- `sendDueNotifications` com o relógio na hora do lembrete de 24 h envia só esse, uma vez, mesmo com duas chamadas simultâneas;
- texto para responsável em `America/Manaus` com professor em São Paulo contém os dois horários.

- [ ] Testes, implementação e commit `feat: notificações agendadas e worker`.

### Etapa 11: Aula, presença, desfecho e repasse

**Interfaces produzidas:**
- `lessons/room.ts`: `joinRoom(deps, bookingId, role, now): {joinUrl}`.
  - Só para aula `confirmed`, de `starts_at − 10 min` até `ends_at + 30 min`.
  - A família entra por um link assinado (HMAC do `booking_id` e do papel, com validade).
- `lessons/presence.ts`: `handleVideoWebhook(...)`. Grava em `webhook_events` e atualiza `teacher_joined_at`, `student_joined_at` e os segundos de cada um.
- `lessons/checkin.ts`:
  - `checkinCode(bookingId): string`, de 6 dígitos, derivado por HMAC, para poder ser mostrado de novo sem guardar o código em claro;
  - `submitCheckin(deps, teacherId, bookingId, code, now)`, aceito de `starts_at − 30 min` a `ends_at + 2 h`, com no máximo 5 tentativas.
- `lessons/close.ts`: `closeLessons(deps, now)`, para aulas `confirmed` com `ends_at + 10 min ≤ now`.
  - **Online:**
    - os dois entraram: `taught`, e a aula passa a `completed`;
    - só o professor: `student_no_show`, e a aula passa a `no_show`;
    - só o aluno, ou o professor entrou depois de `TEACHER_NO_SHOW_MINUTES`: `teacher_no_show`, a aula passa a `cancelled` e entra o reembolso integral (tarefa `payment.refund`, notificação `falta_professor_reembolso`).
  - **Presencial:** com código, `taught`. Sem código, a aula fica para decisão no painel interno (Etapa 14).
  - Ninguém entrou: também vai para o painel.
  - `pendingDecisions(db): Promise<PendingLesson[]>` lista as aulas `confirmed` encerradas sem evidência.
  - `decideOutcome(deps, bookingId, outcome: 'taught'|'student_no_show'|'teacher_no_show', staffId, now)` aplica o mesmo caminho do fechamento automático e registra quem decidiu.
- `payouts/create.ts`: `createPayoutForBooking(trx, bookingId, now)`. Cria o repasse quando a aula termina `completed` (e em `no_show`, conforme a pergunta 2):
  - bruto = `total_cents / lessons`;
  - `commission_bps` vem do pedido;
  - `release_after = ends_at + DISPUTE_WINDOW_HOURS`;
  - `provider_escrow_id` é o `provider_charge_id` da cobrança paga.
- `payouts/release.ts`: `releaseDuePayouts(deps, now, limit = 50)`.
  - Consulta da §2.6 com `$now`, marcando `release_attempted_at`.
  - Para cada repasse: `releaseEscrow` e depois `UPDATE ... SET status='released', released_at=$now WHERE id=$1 AND status='releasing'`.
- `payouts/reconcile.ts`: `reconcileReleasing(deps, now)`. Para repasses em `releasing` há mais de 10 min, chama `getEscrow`:
  - se já foi liberado, marca `released`;
  - se continua retido, tenta liberar uma vez.

**Testes** (`tests/domain/lesson-lifecycle.test.ts`):
- presença dos dois: `completed` e um repasse `held` com `release_after` = fim + 24 h;
- só o professor: `no_show`;
- só o aluno: `cancelled`, reembolso chamado e nenhum repasse;
- presencial com código certo: `completed`;
- presencial com código errado: recusado, e na 6ª tentativa bloqueado;
- presencial sem código: aula fica `confirmed` e aparece em `pendingDecisions()`;
- `releaseDuePayouts` antes do prazo não faz nada; depois do prazo libera e chama `releaseEscrow` uma vez;
- com `FAKE_PAYMENT_FAIL=release`, o repasse fica em `releasing` e a conciliação o leva a `released`;
- `releaseDuePayouts` executado duas vezes ao mesmo tempo chama `releaseEscrow` uma vez por repasse;
- a consulta “aulas do professor” não traz endereço nem telefone da família enquanto a aula está `held` e traz o endereço depois de `confirmed` (foco 5).

- [ ] Testes, implementação e commit `feat: sala, código presencial, desfecho e repasse`.

---

## Parte C — Telas (uma etapa por vez, com commit ao fim de cada)

Os testes das telas são de rota/servidor (Vitest chamando as ações) mais o fluxo completo da Etapa 18. As telas usam os serviços da Parte B e não escrevem SQL.

### Etapa 12: Login por código (professor, equipe e responsável)

- `auth/codes.ts`:
  - `requestCode(purpose, destination, now)`: 6 dígitos, validade de 10 min, hash HMAC, no máximo 5 envios por hora por destino;
  - `verifyCode(...)`: no máximo 5 tentativas.
- `sessions.ts`: cookie `httpOnly`, `Secure`, `SameSite=Lax`; no banco só o hash do token.
- `guardians/identify.ts`: `identifyGuardian({name, phone, email, whatsappOptIn, timezone})`.
  - O telefone é normalizado para E.164 com `libphonenumber-js` e região BR.
  - Se o telefone já existe com outro e-mail, o código vai para o e-mail que já está na conta, mostrado mascarado.
- Rotas: `/professor/entrar`, `/interno/entrar`. A equipe é semeada a partir de `ADMIN_EMAILS` no `db:seed`.
- **Testes:**
  - formatos diferentes do mesmo telefone dão o mesmo responsável (foco 2);
  - o código não vai para um e-mail novo quando o telefone já tem dono;
  - código vencido ou usado é recusado;
  - a 6ª tentativa é bloqueada.

### Etapa 13: Cadastro, perfil, verificação e conta de recebimento do professor

- `/professor/cadastro`: nome, `slug` (único, só `a-z0-9-`), chamada, bio, fuso, disciplinas × séries do catálogo, telefone e aceite de WhatsApp, CEP-base e raio.
- `/professor/verificacao`: envio de identidade (documento + selfie), certidão e formação para o `FileStorage`.
  - Cria `teacher_verifications` com `status='pending'` e `evidence_key` = prefixo da pasta.
  - Recusada, pode reenviar.
- `/professor/recebimento`: formulário enviado direto a `createRecipientAccount`. Guarda só ids e estado.
- “Enviar para análise” leva `draft` a `in_review`. Exige perfil completo, as três verificações enviadas e a conta de recebimento.
- O catálogo vem de `db:seed`, com as disciplinas sugeridas (Matemática, Física, Química e Redação) e as séries 6º ano a 9º ano, 1ª a 3ª série e pré-vestibular.
- **Testes:**
  - `slug` repetido é recusado;
  - nenhum documento é gravado em coluna do banco: só `evidence_key`, e o arquivo cifrado fica em `var/private`;
  - não dá para enviar para análise sem as três verificações.

### Etapa 14: Painel interno

- `/interno/verificacoes`: fila em ordem de chegada.
  - Mostra os documentos por link temporário.
  - Aprovar ou recusar com motivo. A certidão recebe `valid_until`, por padrão hoje + `CRIMINAL_RECORD_VALIDITY_MONTHS`, editável.
  - Aprovar o perfil (`approved`) só fica possível com as três verificações aprovadas e em dia.
  - Também dá para pausar ou suspender o perfil.
- `/interno/aulas`: aulas sem evidência, onde a equipe decide entre `taught`, `student_no_show` e `teacher_no_show` (cada uma segue o caminho da Etapa 11); repasses por estado; webhooks não processados.
- `expireVerifications`: certidão vencida passa a `expired`, o que já tira o professor de `teachers_listed`.
- **Testes:**
  - rota interna sem sessão da equipe dá 403;
  - aprovar o perfil com uma verificação pendente é recusado;
  - link de documento vencido dá 403.

### Etapa 15: Agenda do professor

- `/professor/agenda`:
  - regras semanais (dia, início e fim locais, vigência);
  - bloqueios por data, de dia inteiro ou de intervalo, e horários extras;
  - antecedência, janela, grade e limite diário.
- `/professor/servicos`:
  - disciplina, modalidade (online, na casa do aluno, no endereço do professor), duração e preço;
  - intervalo antes e depois, que é o deslocamento no presencial;
  - ativar e desativar;
  - endereço do professor, obrigatório quando houver serviço “no endereço do professor”.
- Calendário: “Conectar Google” cria `calendar_connections` com o adaptador falso. Os compromissos simulados entram por `/dev`.
- **Testes:**
  - regra com fim antes do início é recusada;
  - mudar regra ou serviço muda `free_slots` na hora e não altera aulas já reservadas;
  - o serviço presencial sugere um intervalo de deslocamento, editável.

### Etapa 16: Página pública e reserva

- `/p/[slug]`:
  - Mostra o perfil, o selo das três verificações com validade e os serviços por modalidade.
  - Mostra os horários de `free_slots` calculados na hora, no fuso do navegador e agrupados por data de quem vê.
  - Perfil não aprovado dá 404. Aprovado, mas fora de `teachers_listed` ou sem conta de recebimento, aparece como “agenda indisponível”.
  - A primeira visita grava a origem `teacher_link` (cookie + `teacher_guardian_links` na identificação).
  - Botão “enviar para meu responsável” (§1, “quando o aluno procura sozinho”): abre o compartilhamento do WhatsApp com o link da página ou do horário. Não cria conta nem guarda nada do aluno.
- `/p/[slug]/reservar`, depois de escolher o horário:
  1. identificação (nome, WhatsApp, e-mail, aceite de WhatsApp, primeiro nome e série do aluno, endereço se a aula for na casa do aluno);
  2. código por e-mail;
  3. `holdSlots`.
  - “Ocupado” mostra “esse horário acabou de ser reservado” e os horários mais próximos, a um clique.
  - Com sessão de responsável ativa, a identificação é pulada.
- `/pedido/[id]`:
  - PIX: QR e copia-e-cola, com cronômetro até `hold_expires_at`. Cartão: formulário do provedor falso.
  - A página consulta o estado a cada 3 s até ir para `/pedido/[id]/confirmado`.
  - A confirmação mostra o horário (dois horários se os fusos diferirem), o link da sala ou o código da aula presencial e o endereço do professor quando for o caso.
- **Testes:**
  - o HTML de `/p/[slug]` não contém e-mail, telefone nem `teaching_address`;
  - pedido de outro responsável dá 404.

### Etapa 17: Telas da aula

- `/professor/aulas`: próximas aulas com nome do aluno, série, modalidade, endereço (só depois de pago), campo do código presencial e botão da sala.
- `/aula/[token]`: página da família com “Entrar na aula” (o `joinUrl` do provedor) ou, no presencial, o código a informar.
- `/dev`, só com `DEV_TOOLS=1`:
  - caixa de saída;
  - relógio (avançar);
  - rodar as varreduras agora;
  - simular pagamento PIX ou cartão de uma cobrança;
  - sala de vídeo falsa com “entrar” e “sair”, que disparam webhooks de presença assinados;
  - compromissos de calendário simulados.
- **Testes:**
  - `/dev` dá 404 sem `DEV_TOOLS=1`;
  - token de aula vencido ou adulterado é recusado.

### Etapa 18: Fluxo de ponta a ponta, README e pendências

`tests/e2e/fluxo-completo.spec.ts` (Playwright, Chromium pré-instalado), com web e worker reais e adaptadores falsos:
1. Professora entra por código (lido em `/dev`), monta o perfil `ana-matematica`, envia os 3 documentos, abre a conta de recebimento e envia para análise.
2. A equipe aprova as 3 verificações e o perfil.
3. A professora configura terça 14h–18h, serviço online de 60 min a R$ 121,00 e serviço na casa do aluno com 30 min de deslocamento.
4. A família abre `/p/ana-matematica`, escolhe um horário, identifica-se, digita o código e paga por PIX (“simular pagamento”). Resultado:
   - a tela de confirmação aparece;
   - `/dev` mostra confirmação por WhatsApp e e-mail para a família e para a professora;
   - os lembretes de 24 h e 1 h estão agendados.
5. Uma segunda família tenta o mesmo horário e vê “acabou de ser reservado”.
6. O relógio avança até a aula. Professora e aluno entram na sala falsa. O relógio passa do fim e as varreduras rodam. Resultado: aula `completed` e repasse `held` com R$ 114,95 para a professora e R$ 6,05 para a plataforma (link do professor, 5%).
7. O relógio avança 24 h e as varreduras rodam. Resultado: repasse `released`, com 1 chamada `releaseEscrow`.
8. Conferência final: nenhum par de aulas ativas se sobrepõe (consulta de auto-junção com `&&`).

Também nesta etapa:
- `README.md`: requisitos, `docker compose up -d`, `npm ci`, `npm run db:migrate`, `npm run db:seed`, `npm run dev` + `npm run worker`, como usar `/dev`, testes, estrutura e como plugar adaptadores reais;
- `docs/pendencias.md` fechado. O arquivo nasce na Etapa 0 e cresce a cada etapa. Itens:
  - credenciais e homologações: Asaas (conta principal com CNPJ, subcontas, Conta Escrow, token de webhook), vídeo (Daily ou Whereby), WhatsApp Cloud API (número e modelos aprovados), e-mail (SES), Google Cloud (OAuth e verificação), geocodificação e armazenamento S3;
  - decisões de produto: cidade de lançamento, disciplinas, comissão 15%/5%, regra de cancelamento e de falta do aluno, piso de preço, quem pode dar aula e o formato de `credits`;
  - valores sugeridos que viraram configuração (restrição global 10);
  - pontos a validar com o provedor: estorno com retenção ativa, `daysToExpire`, mensalidade por subconta, liquidação do cartão em cerca de 32 dias e CPF do pagador;
  - pontos a validar com o provedor de vídeo: entrada restrita, presença por webhook e tempo mínimo de presença;
  - jurídico: termos, privacidade, ECA/LGPD e descarte de documentos depois da decisão;
- verificação do zero: `docker compose down -v`, depois `docker compose up -d && npm ci && npm run db:migrate && npm run db:seed && npm test && npm run test:e2e`, tudo verde;
- commit `test(e2e): fluxo completo com adaptadores falsos; docs`.

---

## Desvios mínimos da especificação

Precisam do seu de acordo.

1. **Relógio como parâmetro.** As consultas do apêndice que usam `now()` (expiração no caminho, liberação de repasse) recebem `$now`, como `free_slots` já faz com `:'now'`. Sem isso, o teste de ponta a ponta não consegue simular o tempo passando.
2. **`refresh_next_slot` começa um dia antes.** O apêndice usa `p_now::date`, que depende do fuso da sessão do banco: com sessão em UTC, às 22h em São Paulo já é o dia seguinte e os horários da noite somem do retrato. A troca por `p_now::date - 1` não muda o resultado, porque `free_slots` filtra por instante.
3. **Duas operações a mais na interface de pagamento**: `createRecipientAccount` e `getEscrow` (§1 passo 4 e §3.4, “sem aviso de liberação”). **Duas interfaces a mais**: `FileStorage` (regra 8) e `Geocoder` (raio da aula na casa do aluno).
4. **Repasse criado quando a aula termina**, como diz a §2.2 (“cada aula concluída gera um repasse”), e não no pagamento. A comissão continua congelada desde a reserva em `orders.commission_bps`.

## Decisões de 16/11/2026

As perguntas 1 a 4 abaixo foram respondidas com as propostas como estão. A pergunta 5 (repositório) segue em aberto.

## Perguntas em aberto (preciso das respostas antes de codar)

1. **A ordem da reserva.** A jornada (§1) prende o horário (passo 4) antes de a família se identificar (passo 5). Só que `orders.student_id` e `bookings.student_id` são `NOT NULL`, e aula na casa do aluno exige `address_id` no próprio `INSERT`. Com a tabela `bookings` intocada, a reserva temporária só pode nascer depois da identificação.
   - **Proposta:** a família escolhe o horário, identifica-se, confirma o código, e só então o banco tenta prender o horário. Os 10 minutos cobrem o pagamento.
   - Se o horário tiver acabado nesse meio-tempo, a família vê os mais próximos a um clique, sem redigitar nada.
   - Quem já tem sessão pula direto para a reserva.
2. **Falta do aluno e falta do professor na Fase 1.** A regra de cancelamento está pendente, e remarcação e contestação são da Fase 2.
   - **Proposta:** falta do professor dá reembolso integral automático. Falta do aluno paga o professor por inteiro, com percentual configurável (`STUDENT_NO_SHOW_TEACHER_PCT=100`). Presencial sem código vai para decisão da equipe no painel.
3. **Venda pelo link com verificação vencida.** A especificação só diz que o professor sai da busca.
   - **Proposta:** a página só vende se o professor estiver em `teachers_listed`, isto é, aprovado e com as três verificações em dia, e tiver conta de recebimento ativa.
4. **Piso de preço.** A especificação prevê um piso, mas não dá valor.
   - **Proposta:** `PRICE_FLOOR_CENTS` configurável, começando em 0, e a pendência registrada.
5. **Onde guardar o código.** Esta pasta não é um repositório git e o contêiner é descartado ao fim da sessão. Preciso de um repositório no GitHub para enviar os commits de cada etapa.

## Fora desta entrega

Busca pública (tela), avaliações (tela), mensagens, conta do responsável com histórico, remarcação e cancelamento pela família, contestação aberta pela família, recorrência e pacote (fora o teste de pacote do apêndice), sincronização incremental do Google, Outlook, empresas e escolas.
