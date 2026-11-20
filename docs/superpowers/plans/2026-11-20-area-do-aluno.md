# Área do aluno (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dar à família uma área no molde da área do professor: cadastro sem compra, painel com Início, Aulas, Alunos e Meus dados.

**Architecture:** `/conta` sai do grupo `(aluno)` para um grupo próprio `(conta)` (entrar e criar com invólucro simples; o resto em `(painel)` com topo e `PanelNav`). Regras novas no domínio: `guardians/signup.ts` (cadastro), `guardians/students.ts` (alunos), `guardians/profile.ts` (meus dados). Dois propósitos novos de código por e-mail (`guardian_signup`, `guardian_email_change`) numa migração.

**Tech Stack:** Next.js 16, Kysely, PostgreSQL, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-20-area-do-aluno-design.md`.

## Global Constraints

- Aluno só com primeiro nome e série; nenhum login de menor.
- Nenhuma tela diz se um e-mail ou WhatsApp já tem conta (a não ser para quem já está dentro da própria conta).
- URLs: `/conta`, `/conta/entrar`, `/conta/avaliar/[booking]` não mudam; novas: `/conta/criar`, `/conta/aulas`, `/conta/alunos`, `/conta/dados`.
- No celular (390 px) nada de rolagem lateral; alvos de toque com 44 px.
- Fechado no modo lista de espera (o porteiro já bloqueia `/conta`; vale para as novas).

## Review Focus

- **Cadastro com WhatsApp de outra conta:** o código vai para o e-mail da conta existente e a pessoa entra nela, sem trocar o e-mail (Task 1).
- **Cadastro com e-mail de outra conta (WhatsApp novo):** entra na conta do e-mail, sem criar outra (Task 1).
- **Responsável sem aluno reserva:** a reserva pede só primeiro nome e série (Task 1).
- **Remover aluno com aula:** recusado com mensagem clara; o aluno continua (Task 3).
- **Trocar o e-mail para um que já está em outra conta:** recusado (Task 4); código do e-mail novo usado por outra sessão não troca nada (Task 4).

---

### Task 1: Criar conta sem comprar

**Files:** Create `db/migrations/0014_area_do_aluno.sql`, `src/domain/guardians/signup.ts`, `tests/domain/guardian-signup.test.ts`, `src/app/(conta)/...` só para `criar` nesta task (o grupo inteiro vem na Task 2 — aqui a página fica em `src/app/(aluno)/conta/criar/page.tsx`); Modify `src/domain/auth/codes.ts` (`CodePurpose`), `src/app/(aluno)/conta/actions.ts`, `src/app/(aluno)/conta/entrar/page.tsx`, `src/components/BookingForm.tsx`, `src/app/(aluno)/p/[slug]/reservar/page.tsx`, `tests/e2e/fluxo-completo.spec.ts`.

**Interfaces:**
- `startGuardianSignup(deps, input: { name; email; phone; whatsappOptIn: boolean; timezone; studentFirstName?: string; studentGrade?: string }, now): Promise<{ codeId; sentTo }>` — valida como `identifyGuardian` (aluno opcional, mas se vier o nome, a série é obrigatória).
- `finishGuardianSignup(deps, { codeId, code }, now): Promise<{ ok: true; token; guardianId } | { ok: false; reason }>` — WhatsApp com conta → essa conta (atualiza fuso e avisos, mantém e-mail); senão e-mail com conta → essa conta; senão cria. Aluno informado entra sem duplicar (mesmo primeiro nome atualiza a série).

- [ ] Step 1: testes que falham — conta nova com e sem aluno; WhatsApp existente (código vai ao e-mail antigo, entra na conta, e-mail não muda); e-mail existente com WhatsApp novo (entra na conta do e-mail, não cria outra); aluno repetido não duplica; série obrigatória quando há nome. E2E: um adulto cria conta sem aluno em `/conta/criar`, cai em `/conta`; depois reserva informando só primeiro nome e série.
- [ ] Step 2–5: rodar, implementar, passar, commit. `BookingForm`: `loggedIn` vale para qualquer responsável com sessão; sem aluno, “Outro aluno” vem marcado.

### Task 2: Painel da conta (Início e Aulas)

**Files:** Move `src/app/(aluno)/conta/**` → `src/app/(conta)/conta/**` (`entrar`, `criar` com invólucro próprio; `page.tsx`, `avaliar` e as novas em `(painel)`); Create `src/app/(conta)/layout.tsx`, `src/app/(conta)/conta/(painel)/layout.tsx`, `src/app/(conta)/conta/(painel)/aulas/page.tsx`; Modify `src/components/professor/PanelNav.tsx` (sem “Mais” quando não sobra item; colunas pelo número de itens), `src/domain/guardians/account.ts` (`pendingReviews`), `tests/e2e/fluxo-completo.spec.ts`.

**Interfaces:** menu `label="Minha conta"`: Início `/conta`, Aulas `/conta/aulas`, Alunos `/conta/alunos`, Meus dados `/conta/dados`, todos na barra de baixo (`primary` com os quatro). Aulas usa `accountView` (Próximas = `upcoming`, Anteriores = `past`, `?aba=anteriores`). A avaliação volta para `/conta/aulas?aba=anteriores&avaliada=1`.

- [ ] Step 1: e2e que falha — depois da aula, a responsável entra, vê o menu “Minha conta” com os quatro itens e “Sair” no topo; o Início mostra o cartão “1 aula esperando sua avaliação”; clicando, avalia; volta para Aulas › Anteriores com “Obrigado pela avaliação!” e “Sua avaliação”. A 390 px, sem rolagem lateral.
- [ ] Step 2–5: mover, layouts, Início com cartões (próxima aula, alunos, avaliar) e estados vazios, Aulas em abas, rodar, commit.

### Task 3: Alunos

**Files:** Create `src/domain/guardians/students.ts`, `tests/domain/guardian-students.test.ts`, `src/app/(conta)/conta/(painel)/alunos/page.tsx`, ações em `src/app/(conta)/conta/actions.ts`; Modify `tests/e2e/fluxo-completo.spec.ts`.

**Interfaces:** `listStudents(db, guardianId): Promise<Array<{ id; firstName; grade; gradeName; hasLessons: boolean }>>` (por nome); `addStudent(db, guardianId, { firstName; grade }): Promise<string>`; `updateStudent(db, guardianId, studentId, { firstName; grade })`; `removeStudent(db, guardianId, studentId)` — com pedido na conta lança `DomainError('conflict', 'este aluno tem aulas na conta e não pode ser removido')`. Só o primeiro nome é guardado; nome repetido (sem diferenciar maiúsculas) é recusado; aluno de outro responsável é “aluno não encontrado”.

- [ ] Step 1: testes que falham — as regras acima. E2E: a responsável cadastra “Pedro”, 1ª série; edita para 2ª série; remove; tenta remover a aluna com aula e vê a mensagem.
- [ ] Step 2–5.

### Task 4: Meus dados

**Files:** Create `src/domain/guardians/profile.ts`, `tests/domain/guardian-profile.test.ts`, `src/app/(conta)/conta/(painel)/dados/page.tsx`, componente cliente de troca de e-mail; Modify `src/app/(conta)/conta/actions.ts`, `tests/e2e/fluxo-completo.spec.ts`.

**Interfaces:** `guardianProfile(db, guardianId): Promise<{ name; email: string | null; phone; whatsappOptIn: boolean }>`; `updateGuardianProfile(db, guardianId, { name; whatsappOptIn }, now)` (nome de 2 a 80 caracteres; ligar mantém a data antiga se já estava ligado); `startEmailChange(deps, guardianId, newEmail, now): Promise<{ codeId; sentTo }>` (e-mail de outra conta → `DomainError('conflict', 'este e-mail já está em outra conta')`); `finishEmailChange(deps, guardianId, { codeId; code }, now): Promise<{ ok: true } | { ok: false; reason }>` (o código só vale para a conta que pediu).

- [ ] Step 1: testes que falham — as regras acima. E2E: a responsável muda o nome (o “Olá” muda), desliga os avisos, troca o e-mail com o código e entra depois com o e-mail novo.
- [ ] Step 2–5.

### Task 5: Fechamento

- [ ] `npm run check`, `npm run test:e2e`, `npm run build`, capturas (Início, Aulas, Alunos, Meus dados, Criar conta; celular e computador) e PR em rascunho.
