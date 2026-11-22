# Cancelar e remarcar (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a família cancela (com devolução integral se faltam 24 horas ou mais) ou remarca a aula paga; o professor cancela aula paga com devolução integral; os dois são avisados e a agenda se libera.

**Architecture:** domínio em `src/domain/lessons/change.ts` (opções, cancelar pela família, remarcar, cancelar pelo professor, horários para remarcar), na trava do professor e com a restrição de exclusão como garantia; devolução pela tarefa `payment.refund`; avisos por modelos novos na tabela de mensagens agendadas; tarefa nova `calendar.delete_event`. Telas: `/conta/aulas/[booking]` (remarcar e cancelar) e o botão de cancelar em Aulas do professor.

**Tech Stack:** Next.js 16, Kysely, PostgreSQL, Graphile Worker, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-21-cancelar-remarcar-design.md`.

## Global Constraints

- Só a família dona do pedido muda a aula; só o professor da aula cancela pelo lado dele.
- Só aula confirmada e que ainda não começou.
- Devolução só no cancelamento com 24 horas ou mais (família) ou no cancelamento pelo professor; o valor é o da aula (total do pedido dividido pelas aulas).
- Remarcar revalida o novo horário como a reserva (grade, antecedência, limite diário, ocupado); se falhar, nada muda.

## Review Focus

- **Exatamente 24 horas antes:** ainda cancela com devolução (Task 1).
- **Remarcar para um horário que alguém acabou de pegar:** recusa e a aula antiga continua confirmada (Task 1).
- **Terceira remarcação:** recusada (Task 1).
- **Aula de outra família ou já começada:** recusada (Task 1).
- **Lembretes da data antiga:** não saem (a aula antiga deixa de estar confirmada) (Task 1).

---

### Task 1: Domínio

**Files:** Create `src/domain/lessons/change.ts`, `tests/domain/lesson-change.test.ts`; Modify `src/domain/notifications/catalog.ts`, `templates.ts`, `schedule.ts`, `send.ts`, `src/domain/jobs.ts`, `src/worker/enqueue.ts`, `src/worker/tasks.ts`.

**Interfaces:**
- `FREE_CANCEL_HOURS = 24`, `MAX_RESCHEDULES = 2`.
- `changeOptions(db, guardianId, bookingId, now): Promise<{ canCancel; canReschedule; refundCents; freeCancelUntil: Instant; reschedulesLeft } | null>`.
- `cancelByFamily(deps, { guardianId, bookingId }, now): Promise<{ refundCents: number }>`.
- `rescheduleByFamily(deps, { guardianId, bookingId, startsAt }, now): Promise<{ ok: true; bookingId } | { ok: false; reason: 'ocupado' | 'indisponivel' | 'antecedencia' | 'limite_diario' }>`.
- `cancelByTeacher(deps, { teacherId, bookingId }, now): Promise<{ refundCents: number }>`.
- `rescheduleSlots(deps, guardianId, bookingId, now): Promise<Instant[]>`.
- Modelos novos: `cancelada_pela_familia` (professor), `cancelamento_confirmado` (família), `remarcada_professor`, `remarcada_responsavel`, `cancelada_pelo_professor` (família).

- [ ] Step 1: testes que falham — opções antes e depois das 24 horas; cancelar com devolução (pedido e tarefa de devolução, aviso ao professor e à família, horário livre de novo); cancelar com menos de 24 horas recusado; remarcar (aula nova confirmada no mesmo pedido, antiga remarcada, avisos, lembretes da nova data, horário antigo livre); horário ocupado recusado sem mudar nada; terceira remarcação recusada; outra família e aula começada recusadas; professor cancela com devolução e aviso à família.
- [ ] Step 2–5.

### Task 2: Telas

**Files:** Create `src/app/(conta)/conta/(painel)/aulas/[booking]/page.tsx`, componente cliente da remarcação; Modify `src/app/(conta)/conta/(painel)/aulas/page.tsx` (botão “Remarcar ou cancelar”), `src/app/(conta)/conta/(painel)/actions.ts`, `src/app/(professor)/professor/(painel)/aulas/page.tsx` e `actions.ts`, `tests/e2e/fluxo-completo.spec.ts`.

- [ ] Step 1: e2e que falha — a família nova paga, remarca para o mês seguinte (vê a data nova; o professor recebe “Aula remarcada”), cancela com devolução (vê “Aula cancelada”, a devolução fica na fila; o professor recebe “Aula cancelada”).
- [ ] Step 2–5.

### Task 3: Fechamento

- [ ] `npm run check`, `npm run test:e2e`, `npm run build`, capturas e PR em rascunho.
