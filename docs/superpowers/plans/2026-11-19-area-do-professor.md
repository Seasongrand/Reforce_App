# Área do professor: painel e perfil com prévia (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dar ao professor uma área com cara de produto, inspirada na Telavita: painel de boas-vindas com menu lateral e checklist do que falta, e um editor de perfil com prévia ao vivo de como os alunos veem a página, com especialidades e anos de experiência.

**Architecture:** as telas do professor saem do grupo `(marketplace)` (invólucro estreito) para um grupo próprio `(professor)`, com um layout de painel (topo + menu lateral; no celular, menu horizontal). As regras novas ficam no domínio (`teachers/profile.ts`, `teachers/dashboard.ts`), testadas com PostgreSQL real. A página pública e a prévia usam o mesmo componente de apresentação, para a prévia nunca divergir do que o aluno vê.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Tailwind 4, Kysely + PostgreSQL 16, Vitest, Playwright.

**Spec:** a seção “Decisões” abaixo (o dono pediu, em 19/11, que eu decidisse; a conversa tem o pedido com as telas da Telavita).

## Decisões (19/11)

- **Quando vale:** pronto para a abertura. No modo lista de espera, `/professor/*` continua fechado (o proxy não muda).
- **Visual:** identidade da Reforce (índigo, amarelo, Space Grotesk e Inter), com a estrutura da Telavita: topo com nome e “Sair”, menu lateral (Início, Meu perfil, Serviços e preços, Agenda, Aulas, Documentos, Recebimento), cartões com estado vazio e chamada para a ação. As classes globais dos painéis (`.btn`, `.card`, `.input`…) ganham o visual novo, o que moderniza também as telas internas sem reescrevê-las.
- **Início:** “Olá, <primeiro nome>”, checklist com 7 passos e progresso (“3 de 7”), próximas aulas e “Sua página” (link e compartilhar por WhatsApp, Facebook, LinkedIn e copiar; antes da aprovação, aviso de que a página entra no ar depois dela).
- **Perfil:** o editor mostra ao lado (no celular, abaixo) a prévia com o mesmo componente da página pública. Campos novos: **especialidades** (até 6, de uma lista fechada, como as “Experiências” da Telavita) e **ano em que começou a dar aula** (mostrado como “N anos de experiência”). Os demais campos e IDs do formulário continuam (o teste ponta a ponta usa).
- **Rotas e textos mantidos:** `/professor`, `/professor/cadastro` (o editor de perfil; o menu chama de “Meu perfil”), `/professor/servicos`, `/professor/agenda`, `/professor/aulas`, `/professor/verificacao`, `/professor/recebimento`, `/professor/entrar`; botões “Salvar perfil”, “Enviar foto”, “Enviar para análise” e o `data-testid="teacher-status"`.

## Global Constraints

- Nenhuma promessa que o sistema não cumpre; nenhum dado de contato do professor na página pública.
- Especialidades (chave → rótulo), nesta ordem: `reforco` Reforço escolar · `tarefas` Ajuda com tarefas e trabalhos · `provas` Preparação para provas · `recuperacao` Recuperação · `base` Recuperar a base · `dificuldades` Dificuldades de aprendizagem · `enem` ENEM · `vestibular` Vestibulares · `tecnicas_militares` Escolas técnicas e militares · `olimpiadas` Olimpíadas do conhecimento. No máximo 6 por professor.
- Ano em que começou a dar aula: inteiro de 1950 até o ano corrente (fuso America/Sao_Paulo); vazio = não informado. Exibição: “1 ano de experiência” / “N anos de experiência” (N = ano corrente − ano informado; com N = 0, “Começou a dar aula este ano”).
- Celular de 390 px sem rolagem lateral em todas as telas novas.
- Commits terminam com as linhas de atribuição do lembrete do sistema.

## Review Focus

- **Professor sem serviço:** a prévia e o painel mostram “Defina o preço em Serviços e preços”, nunca “R$ 0,00” nem um bloco vazio (Task 4, teste do resumo de serviços).
- **Especialidade fora da lista ou mais de 6:** recusada com mensagem, sem gravar nada (Task 1).
- **Ano inválido** (futuro, antes de 1950, texto): recusado; campo vazio grava “não informado” (Task 1).
- **Menu do painel no celular:** não cria rolagem lateral a 390 px (Task 2, teste no navegador).
- **Professor ainda não aprovado:** o painel não mostra link quebrado da página pública; diz que ela entra no ar depois da aprovação (Task 3).

---

### Task 1: Especialidades e experiência no perfil (dados e regras)

**Files:**
- Create: `db/migrations/0013_perfil_especialidades.sql`
- Modify: `src/domain/teachers/profile.ts`, `src/domain/public/teacher-page.ts`, `src/db/types.ts` (regerado)
- Test: `tests/domain/teacher-onboarding.test.ts` (novo `describe('especialidades e experiência')`), `tests/domain/public-teacher-page.test.ts` (ou o arquivo de teste existente da página pública)

**Interfaces:**
- Produces: `TEACHER_SPECIALTIES` (registro ordenado chave → rótulo), `type Specialty`, `MAX_SPECIALTIES = 6` em `profile.ts`; `ProfileInput.specialties?: Specialty[]` e `ProfileInput.teachingSince?: number | null`; `experienceLabel(teachingSince: number | null, now: Temporal.Instant): string | null` em `profile.ts`; `PublicTeacherPage.specialties: string[]` (rótulos, na ordem do catálogo) e `PublicTeacherPage.experience: string | null`.

- [ ] **Step 1: testes que falham** — (a) `updateTeacherProfile` com `specialties: ['enem','reforco']` e `teachingSince: 2013` grava `specialties = {reforco,enem}` (ordem do catálogo) e `teaching_since = 2013`; (b) `specialties: ['inventada']` → erro /especialidade/; 7 especialidades → erro /até 6/; (c) `teachingSince: 2027` (com NOW em 2026) e `1949` → erro /ano/; `null` grava NULL; (d) `experienceLabel(2013, NOW)` = '13 anos de experiência', `(2025)` = '1 ano de experiência', `(2026)` = 'Começou a dar aula este ano', `(null)` = null; (e) `publicTeacherPage` de professor aprovado com esses dados devolve `specialties: ['Reforço escolar','ENEM']` e `experience: '13 anos de experiência'`.
- [ ] **Step 2:** rodar `npx vitest run tests/domain/teacher-onboarding.test.ts` → falha (coluna/função não existe).
- [ ] **Step 3:** migração `0013`: `teachers.specialties text[] NOT NULL DEFAULT '{}'` com `CHECK (cardinality(specialties) <= 6 AND specialties <@ ARRAY[...as 10 chaves...])` e `teachers.teaching_since smallint CHECK (teaching_since BETWEEN 1950 AND 2100)`; validação no domínio com as mensagens “especialidade fora da lista”, “escolha até 6 especialidades”, “ano em que começou a dar aula inválido”; quando `specialties`/`teachingSince` vierem `undefined`, o UPDATE não mexe nas colunas (quem chama sem os campos novos não apaga nada). `npm run db:migrate && npm run db:types`.
- [ ] **Step 4:** rodar os testes → passam; `npx tsc --noEmit` limpo.
- [ ] **Step 5: Commit** — “Perfil do professor: especialidades e anos de experiência”.

### Task 2: Visual dos painéis e layout da área do professor

**Files:**
- Modify: `src/app/globals.css` (`--color-brand` #4f46e5, `--color-brand-dark` #4338ca; `.btn`, `.btn-secondary`, `.input`, `.label`, `.card`, `.error`, `.notice` com cantos `rounded-xl`/`rounded-2xl`, altura mínima 44 px, bordas `site-field`/`site-line`, texto `indigo-950`)
- Move: `src/app/(marketplace)/professor/**` → `src/app/(professor)/professor/**`; páginas autenticadas para `src/app/(professor)/professor/(painel)/`
- Create: `src/app/(professor)/layout.tsx` (fundo e fonte do site), `src/app/(professor)/professor/(painel)/layout.tsx` (exige professor; topo com marca, nome e “Sair”; menu), `src/components/professor/PanelNav.tsx` (cliente; `usePathname` para o item ativo, `aria-current="page"`)
- Modify: `src/app/(professor)/professor/entrar/page.tsx` (cartão central no visual novo)
- Test: `tests/e2e/fluxo-completo.spec.ts`

**Interfaces:**
- Produces: `PanelNav({ items: Array<{ href: string; label: string }> })`; o layout do painel recebe o nome do professor de `teachers.display_name`.

- [ ] **Step 1: teste que falha** — no fluxo completo, logo depois do login da professora: `getByRole('navigation', { name: 'Área do professor' })` contém os links “Início”, “Meu perfil”, “Serviços e preços”, “Agenda”, “Aulas”, “Documentos”, “Recebimento”; o link da página atual tem `aria-current="page"`; a 390 px, `scrollWidth <= 390` em `/professor`.
- [ ] **Step 2:** rodar `npx playwright test --trace off` → falha (menu não existe).
- [ ] **Step 3:** mover as rotas (`git mv`), ajustar imports relativos, criar os layouts e o menu; o login continua sem o menu.
- [ ] **Step 4:** `npx tsc --noEmit`, `npm run check` e `npm run test:e2e` → passam.
- [ ] **Step 5: Commit** — “Área do professor: layout de painel com menu e visual novo”.

### Task 3: Painel “Início” com checklist

**Files:**
- Create: `src/domain/teachers/dashboard.ts`, `tests/domain/teacher-dashboard.test.ts`
- Modify: `src/app/(professor)/professor/(painel)/page.tsx`

**Interfaces:**
- Consumes: `missingForReview`, `teacherPhotoState`, `teacherLessons`.
- Produces: `teacherDashboard(deps: Deps, teacherId: string, now: Temporal.Instant): Promise<TeacherDashboard>` com `{ firstName: string; status: string; steps: DashboardStep[]; done: number; total: number; canSubmit: boolean; pageUrl: string | null; upcoming: TeacherLesson[] }` e `DashboardStep = { key: 'foto'|'perfil'|'documentos'|'recebimento'|'analise'|'servicos'|'agenda'; label: string; done: boolean; detail: string; href: string }`.

- [ ] **Step 1: testes que falham** — professor novo: 7 passos, `done = 0`, `pageUrl = null`, `canSubmit = false`; com perfil salvo, foto enviada (pendente), 3 documentos e conta: passos foto (“Em análise”), perfil, documentos e recebimento feitos, `canSubmit = true`; aprovado, com 1 serviço ativo e 1 regra de agenda: `done = 7` e `pageUrl = '<APP_BASE_URL>/p/<slug>'`; `upcoming` traz no máximo 3 aulas futuras confirmadas, em ordem.
- [ ] **Step 2:** `npx vitest run tests/domain/teacher-dashboard.test.ts` → falha.
- [ ] **Step 3:** implementar `teacherDashboard` (passo “análise”: feito quando `approved`; detalhe “Em análise pela equipe” quando `in_review`); a página mostra “Olá, <primeiro nome>”, barra de progresso, a lista com links, o botão “Enviar para análise” quando `canSubmit` e status `draft`, “Próximas aulas” (estado vazio: “Nenhuma aula marcada ainda. Divulgue sua página para seus alunos.”) e “Sua página” (link + compartilhar; sem `pageUrl`, o aviso de que entra no ar depois da aprovação). Mantém `data-testid="teacher-status"` com os rótulos atuais.
- [ ] **Step 4:** testes do domínio e `npm run test:e2e` → passam.
- [ ] **Step 5: Commit** — “Área do professor: painel Início com checklist, próximas aulas e sua página”.

### Task 4: Editor de perfil com prévia ao vivo

**Files:**
- Create: `src/components/aluno/TeacherProfileView.tsx` (apresentação da página pública: foto, nome, selo, chamada, preço “a partir de”, duração, modalidades, experiência, especialidades, “Dá aula de”, “Sobre”), `src/components/professor/ProfileEditor.tsx` (cliente: estado do formulário + prévia), `src/domain/teachers/service-summary.ts`
- Modify: `src/app/(aluno)/p/[slug]/page.tsx` (usa `TeacherProfileView`), `src/app/(professor)/professor/(painel)/cadastro/page.tsx`, `src/app/(professor)/professor/actions.ts` (`saveProfileAction` lê `specialty` múltiplo e `teachingSince`)
- Test: `tests/domain/teacher-dashboard.test.ts` (resumo de serviços), `tests/e2e/fluxo-completo.spec.ts`

**Interfaces:**
- Consumes: `TEACHER_SPECIALTIES`, `experienceLabel`, `PublicTeacherPage`.
- Produces: `teacherServiceSummary(db: Db, teacherId: string): Promise<{ minPriceCents: number | null; durations: number[]; modalities: Array<'online'|'at_teacher'|'at_student'> }>`; `TeacherProfileView(props: { name; photoUrl; verified; headline; minPriceCents; durations; modalities; experience; specialties; subjects; bio; children? })` — o resto da página pública (próximo horário, reserva, avaliações) entra como `children`.

- [ ] **Step 1: testes que falham** — `teacherServiceSummary` sem serviços → `{ minPriceCents: null, durations: [], modalities: [] }`; com serviços 60 min/R$ 121 online e 90 min/R$ 150 na casa do aluno (e um inativo de R$ 50) → `{ 12100, [60, 90], ['online','at_student'] }`. No navegador: na tela do perfil, digitar a chamada atualiza a prévia (`getByTestId('previa')` contém o texto); marcar “ENEM” e informar 2013 mostra “ENEM” e “13 anos de experiência” na prévia (com o relógio do teste); sem serviço, a prévia diz “Defina o preço em Serviços e preços”; depois da aprovação, a página pública mostra “ENEM” e a experiência.
- [ ] **Step 2:** rodar → falha.
- [ ] **Step 3:** implementar; o formulário envia por `onSubmit` + `startTransition` (o React 19 limpa formulários enviados por `action`), mantém IDs e rótulos atuais; especialidades como fichas de caixa de seleção (`name="specialty"`), com contador “N de 6”; prévia fixa ao lado no computador e abaixo no celular.
- [ ] **Step 4:** `npm run check` e `npm run test:e2e` → passam.
- [ ] **Step 5: Commit** — “Área do professor: editor de perfil com prévia ao vivo”.

### Task 5: Fechamento

- [ ] README (seção do professor) e `docs/pendencias.md` (especialidades e experiência são declaradas pelo professor, sem verificação); capturas a 390 e 1280 px de `/professor` e `/professor/cadastro`; `npm run check` e `npm run test:e2e` limpos; PR em rascunho.
