# Acesso do administrador a todas as áreas (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** no site publicado (modo lista de espera), o dono, com a senha da equipe, passa pelo bloqueio e entra no painel interno, como professor de teste e como aluno de teste, sem depender do e-mail; o público continua vendo só a lista de espera.

**Architecture:** a decisão do proxy vira uma função pura (`waitlistGate`) com teste; ela deixa passar as rotas fechadas quando o pedido traz a senha da equipe (HTTP Basic, a mesma de `/equipe`). `appDeps()` passa a funcionar no modo lista de espera quando `SESSION_SECRET` e `FILE_ENCRYPTION_KEY` existem. Em `/equipe`, três botões (ações do servidor, que conferem a senha de novo) garantem a conta (equipe, professor de teste, responsável de teste com um aluno), criam a sessão e redirecionam.

**Tech Stack:** Next.js 16 (proxy, Server Actions), Kysely + PostgreSQL 16, Vitest, Playwright.

**Spec:** pedido do dono em 19/11 (“deixa todas as áreas com acesso pra mim, sou o adm”), com a opção escolhida “Acesso de adm pela senha”: só quem tem a senha passa; botões “Painel interno”, “Ver como professor”, “Ver como aluno” com contas de teste; o público continua vendo só a lista de espera; pagamentos continuam simulados.

## Global Constraints

- O público (sem a senha) continua recebendo 404 em toda rota fechada; nada muda para ele.
- Contas de teste com e-mails do domínio reservado `.invalid` (nunca recebem e-mail de verdade): equipe = o `CONTACT_EMAIL` configurado (é do dono; quando o e-mail estiver contratado, ele entra também pelo código); professor de teste `professor.teste@reforce.invalid` (“Professor de teste”); responsável de teste `responsavel.teste@reforce.invalid`, telefone `+5500000000000`, com o aluno “Aluno” do 9º ano.
- Sem `SESSION_SECRET` e `FILE_ENCRYPTION_KEY`, o modo lista de espera continua sem marketplace (os botões explicam o que falta).
- Segredos só em variáveis de ambiente; os novos valores da Railway são gerados e gravados sem passar pela conversa.

## Review Focus

- **Rota fechada sem senha, ou com senha errada:** 404, sem pedir senha (não revela que existe) (Task 1).
- **Ação de atalho chamada sem a senha** (alguém que descobre o endpoint): recusa sem criar sessão (Task 3, teste do domínio + checagem na ação).
- **Atalho repetido:** não duplica contas; reaproveita a mesma (Task 2).
- **Modo completo:** nada muda no comportamento atual (Task 1, teste).
- **Variáveis faltando:** mensagem clara em vez de erro 500 (Task 3).

---

### Task 1: Porteiro do modo lista de espera com a senha da equipe

**Files:** Create `src/domain/site-gate.ts`, `tests/domain/site-gate.test.ts`; Modify `src/proxy.ts`.

**Interfaces:** Produces `waitlistGate(input: { path: string; authorization: string | null; siteMode: string | undefined; password: string | undefined }): 'next' | 'not_found' | 'challenge'`.

- [ ] Step 1: testes que falham — `/equipe` sem senha → `challenge`; com senha certa → `next`; sem variável de senha → `not_found`. Modo lista: `/` → `next`; `/professor` sem senha → `not_found`; com senha errada → `not_found`; com a certa → `next` (idem `/interno`, `/conta`, `/p/x`). Modo completo: `/professor` sem senha → `next`.
- [ ] Step 2: `npx vitest run tests/domain/site-gate.test.ts` → falha.
- [ ] Step 3: implementar e fazer o proxy usar a função (lê `SITE_MODE`, `WAITLIST_EXPORT_PASSWORD` e o cabeçalho).
- [ ] Step 4: testes passam; `npx tsc --noEmit`.
- [ ] Step 5: Commit.

### Task 2: Contas de atalho da equipe

**Files:** Create `src/domain/team-shortcuts.ts`, `tests/domain/team-shortcuts.test.ts`; Modify `src/server/app.ts` (`appDeps` no modo lista quando os dois segredos existem).

**Interfaces:** Produces `ensureTeamStaff(deps: Deps): Promise<string>`, `ensureTestTeacher(deps: Deps): Promise<string>`, `ensureTestGuardian(deps: Deps): Promise<string>` (ids; idempotentes); `marketplaceReady(cfg: AppConfig): boolean`.

- [ ] Step 1: testes que falham — cada função cria na primeira chamada e devolve o mesmo id na segunda (contagem não cresce); professor de teste em `draft`, nunca listado; responsável de teste com exatamente um aluno; equipe com o e-mail de `CONTACT_EMAIL`; `marketplaceReady` verdadeiro no modo completo e, no modo lista, só com os dois segredos.
- [ ] Step 2: rodar → falha.
- [ ] Step 3: implementar; `appDeps()` lança a mensagem “acesso da equipe precisa de SESSION_SECRET e FILE_ENCRYPTION_KEY” quando `marketplaceReady` é falso.
- [ ] Step 4: passam.
- [ ] Step 5: Commit.

### Task 3: Botões de acesso em /equipe

**Files:** Create `src/app/(equipe)/equipe/actions.ts`; Modify `src/app/(equipe)/equipe/page.tsx`, `tests/e2e-lista/env.ts` (os dois segredos), `tests/e2e-lista/lista-de-espera.spec.ts`, README, `docs/pendencias.md`.

- [ ] Step 1: teste que falha (navegador, modo lista): sem senha, `/professor` e `/interno` → 404; com senha, em `/equipe`, “Ver como professor” leva a `/professor` com “Olá”; “Painel interno” leva a `/interno`; “Ver como aluno” leva a `/conta` com “Olá”.
- [ ] Step 2: rodar → falha.
- [ ] Step 3: ações `enterAsStaffAction`, `enterAsTeacherAction`, `enterAsGuardianAction`: conferem a senha pelo cabeçalho (sem ela, `notFound()`), garantem a conta, criam a sessão (`createSession` + `setSessionCookie`) e redirecionam; a seção “Acessos da equipe” explica que são contas de teste, que pagamentos e e-mails são simulados e, sem os segredos, o que falta configurar.
- [ ] Step 4: `npm run check` e `npm run test:e2e` → passam.
- [ ] Step 5: Commit; depois do merge, gravar `SESSION_SECRET` (48 bytes aleatórios) e `FILE_ENCRYPTION_KEY` (32 bytes em hex) na Railway sem exibir os valores.
