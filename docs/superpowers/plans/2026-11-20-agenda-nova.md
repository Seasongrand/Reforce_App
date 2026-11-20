# Agenda nova e calendário do mês (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** trocar a Agenda do professor pela versão aprovada no protótipo e mostrar ao aluno o mês todo, com os horários livres de cada dia.

**Architecture:** o domínio ganha `addRules` (vários dias de uma vez), remoções que devolvem o que foi removido (para “Desfazer”) e `parseTimeBR` (horário digitado). A tela vira componentes de cliente (`WeekEditor`, `ExceptionsEditor`, `TimeField`) que chamam as ações do servidor; a prévia e a página do professor usam o mesmo `MonthSlots`, com a grade do mês calculada por `monthGrid`.

**Tech Stack:** Next.js 16 (Server Actions), React 19, Tailwind 4, Kysely, Vitest, Playwright.

**Spec:** protótipo aprovado pelo dono em 20/11 (https://claude.ai/artifact/KtaeZ2KC1p1UyKQXWvvu3v): semana por dias com “+ Adicionar horários” (dias em fichas, “Seg a Sex”, “Todos os dias”), horário digitado ou escolhido na lista, “Desfazer” depois de remover, folgas e horários extras, regras de reserva em frases, Google Agenda e “Como os alunos veem” com o calendário do mês, que também vai para a página do professor.

## Global Constraints

- Nenhuma regra de disponibilidade muda: sobreposição recusada, antecedência, janela, grade e limite diário continuam como estão no banco.
- Horário digitado aceita `8`, `8h`, `8h30`, `830`, `0830`, `8:30`, `08:30`, `8.30`; o servidor sempre confere de novo.
- O calendário do aluno mostra no máximo `min(janela do professor, 62)` dias.
- Alvos de toque com 44 px; nada de rolagem lateral a 390 px.

## Review Focus

- **Vários dias com um já ocupado:** os outros dias entram e a tela diz qual dia ficou de fora (Task 1, Task 3).
- **Desfazer:** volta exatamente a mesma regra, inclusive vigência, e não duplica se tocado duas vezes (Task 1, Task 3).
- **Horário digitado inválido** (`25h`, `8h70`, texto): recusado com a mensagem do formato (Task 1).
- **Mês sem horários / último dia da janela:** o calendário não oferece dia fora da janela nem mês vazio no fim (Task 2).
- **Fuso de quem vê diferente do professor:** os dias do calendário são os de quem vê (Task 2).

---

### Task 1: Domínio: horário digitado, vários dias e remoção com retorno

**Files:** Create `src/lib/time-input.ts`, `tests/domain/time-input.test.ts`; Modify `src/domain/teachers/schedule.ts`, `tests/domain/schedule.test.ts`.

**Interfaces:** `parseTimeBR(text: string): string | null` (“HH:MM”); `addRules(deps, teacherId, { weekdays: number[]; start: string; end: string }): Promise<{ added: number[]; conflicts: number[] }>`; `removeRule(...)`: `Promise<RuleInput | null>`; `removeOverride(...)`: `Promise<OverrideInput | null>`.

- [ ] Step 1: testes que falham — formatos aceitos e recusados; `addRules` com 7 dias e um ocupado devolve 6 adicionados e o dia em conflito; `removeRule` devolve a regra (com vigência) e `addRule` com ela recria igual; `removeOverride` devolve a exceção.
- [ ] Step 2: rodar → falha. Step 3: implementar. Step 4: passam. Step 5: commit.

### Task 2: Calendário do mês na página do professor

**Files:** Create `src/lib/month-calendar.ts`, `tests/domain/month-calendar.test.ts`, `src/components/aluno/MonthSlots.tsx`; Modify `src/components/aluno/ProfileBooking.tsx`, `src/domain/public/teacher-page.ts` (`PUBLIC_DAYS = 62`), `tests/e2e/fluxo-completo.spec.ts`.

**Interfaces:** `monthGrid(year: number, month: number): Array<string | null>` (segunda primeiro; `null` antes do dia 1); `monthsWithDays(keys: string[]): Array<{ year: number; month: number }>`; `MonthSlots({ days: PickerDay[]; tz: string; selected?: string | null; onPick?: (slot: string) => void })`.

- [ ] Step 1: testes que falham — novembro de 2026 começa com 6 vazios e tem 30 dias; meses entre a primeira e a última data; e2e: o perfil mostra “Novembro de 2026”, cada dia com horário traz o número de horários, e escolher um dia mostra os horários dele.
- [ ] Step 2–5: rodar, implementar, passar, commit.

### Task 3: Tela nova da Agenda

**Files:** Create `src/components/professor/TimeField.tsx`, `src/components/professor/WeekEditor.tsx`, `src/components/professor/ExceptionsEditor.tsx`; Modify `src/app/(professor)/professor/(painel)/agenda/page.tsx`, `src/app/(professor)/professor/(painel)/agenda/actions.ts`, `tests/e2e/fluxo-completo.spec.ts`.

- [ ] Step 1: e2e que falha — “+ Adicionar horários”, “Todos os dias”, digitar “8h” e “21:00”, “Adicionar em 7 dias” → 7 dias com 08:00 – 21:00; remover um horário e “Desfazer” devolve; folga de dia inteiro aparece na lista; regras em frases salvam; “Como os alunos veem” mostra o calendário.
- [ ] Step 2–5: rodar, implementar, passar, commit.

### Task 4: Fechamento

- [ ] `npm run check` e `npm run test:e2e`; capturas no celular; README (roteiro) se mudar; PR em rascunho.
