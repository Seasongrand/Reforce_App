# Mensagens (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** conversa entre o responsável e o professor no site, com contatos sempre ocultos e aviso por e-mail.

**Architecture:** domínio em `src/domain/messages.ts` (enviar, ocultar contatos, listar conversas, ler a conversa, não lidas, avisar); migração com leitura e aviso por conversa em `teacher_guardian_links`; tarefa `message.notify` na fila; telas em `/conta/mensagens` e `/professor/mensagens`; `PanelNav` com número de não lidas.

**Tech Stack:** Next.js 16, Kysely, PostgreSQL, Graphile Worker, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-20-mensagens-design.md`.

## Global Constraints

- Só o responsável e o professor da conversa leem e escrevem; a ação do servidor confere a sessão.
- Contato nunca passa: telefone (8+ dígitos, com ou sem separadores), e-mail, URL, `wa.me`, `@perfil`.
- Mensagem de 1 a 2.000 caracteres.
- O aviso não leva o texto da mensagem.
- Horários de envio e de leitura pelo relógio da aplicação (o mesmo do resto do site).

## Review Focus

- **Professor escreve para quem nunca falou com ele:** recusado (Task 1).
- **Família escreve para professor não aprovado:** recusado como “professor não encontrado” (Task 1).
- **Várias mensagens seguidas:** um aviso só em 15 minutos; nada se o destinatário já leu (Task 1).
- **Contato disfarçado** (“11 9 8888 1111”, “maria arroba gmail”): os comuns são pegos; “arroba” por extenso também (Task 1).
- **Quem não entrou toca “Mandar mensagem”:** entra e volta para a conversa, sem cair no Início (Task 2).

---

### Task 1: Domínio das mensagens

**Files:** Create `db/migrations/0015_mensagens.sql`, `src/domain/messages.ts`, `tests/domain/messages.test.ts`; Modify `src/worker/enqueue.ts`, `src/worker/tasks.ts`.

**Interfaces:**
- `hideContacts(text): { text: string; hidden: boolean }`.
- `sendMessage(deps, { teacherId; guardianId; from: 'teacher' | 'guardian'; body }, now): Promise<{ hidden: boolean }>`.
- `conversations(db, viewer: { kind: 'teacher' | 'guardian'; id }): Promise<Conversation[]>` com `{ teacherId; guardianId; name; teacherSlug; lastBody; lastAt; lastFromMe; unread }`, a mais recente primeiro.
- `openThread(db, { teacherId; guardianId }, viewer, now): Promise<ThreadMessage[] | null>` (marca como lida; `null` sem vínculo).
- `unreadTotal(db, viewer): Promise<number>`.
- `notifyNewMessages(deps, { teacherId; guardianId; to }, now): Promise<boolean>` (true se enviou).

- [ ] Step 1: testes que falham — ocultar cada forma de contato; enviar cria o vínculo; professor sem vínculo recusado; não aprovado recusado; mensagem vazia e longa recusadas; lista com não lidas e a mais recente primeiro; abrir marca como lida; aviso uma vez em 15 minutos, nada se já leu, de novo depois de 15 minutos.
- [ ] Step 2–5.

### Task 2: Telas

**Files:** Create `src/app/(conta)/conta/(painel)/mensagens/page.tsx`, `.../mensagens/[slug]/page.tsx`, `src/app/(professor)/professor/(painel)/mensagens/page.tsx`, `.../mensagens/[guardian]/page.tsx`, `src/components/MessageThread.tsx`; Modify `src/components/professor/PanelNav.tsx` (ícone `chat`, número de não lidas), os dois layouts de painel, `src/app/(aluno)/p/[slug]/page.tsx` (botão), `src/app/(aluno)/conta/entrar` e `criar` (`?voltar=`), `tests/e2e/fluxo-completo.spec.ts`.

- [ ] Step 1: e2e que falha — sem entrar, “Mandar mensagem” leva a Entrar com volta para a conversa; a responsável escreve com telefone e e-mail e vê “[contato oculto]” e o aviso; a professora vê 1 não lida no menu, abre, responde; a responsável recebe o aviso por e-mail (uma vez) e vê a resposta.
- [ ] Step 2–5.

### Task 3: Fechamento

- [ ] `npm run check`, `npm run test:e2e`, `npm run build`, capturas e PR em rascunho.
