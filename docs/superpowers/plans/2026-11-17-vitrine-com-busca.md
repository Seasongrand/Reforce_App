# Vitrine com busca — design curto e plano

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Passos com checkbox.

**Pedido (17/11/2026):** a vitrine de professores para a abertura (projeto 2 do lado do aluno). Opção A, escolhida pelo usuário: quando o marketplace abrir (`SITE_MODE=completo`), a página inicial vira a vitrine de busca, e a página dos professores vai para `/professores`. No modo lista de espera, nada muda para o público.

**Goal:** página inicial de busca para o aluno, resultados em `/buscar` com cartões de professor (foto, selo, preço, próximo horário) e a página dos professores também em `/professores`.

**Architecture:**
- **Busca:** usa a consulta já testada (`SEARCH_SQL`, §2.5), com paginação. Uma função de domínio enriquece o resultado com endereço, frase de apresentação e foto.
- **Formulário:** a leitura dos parâmetros da URL é uma função pura.
- **Telas:** componentes do servidor, mais um formulário do cliente que mostra o CEP só quando a aula é presencial.

**Decisões minhas (avisadas ao usuário):**
- **Avaliações:** escondidas até existirem avaliações reais. Até lá, o cartão mostra “Novo na Reforce”.
- **CEP:** a aula presencial usa o `geocoder` atual. O serviço real continua nas pendências.
- **Raio:** na aula “no endereço do professor”, o raio de quem procura é de 10 km.
- **`/professores` no modo completo:** mostra a mesma página dos professores, com a lista de espera, que segue captando inscrições.
- **Fora deste projeto:** as páginas por disciplina e cidade (SEO), que ficam para depois.

## Global Constraints

- **Visual:** direção C (as mesmas cores, letras e tokens `site-*`). Nada passa de 390 px; alvos de toque de 44 px ou mais.
- **Textos:** “aluno” e “adulto responsável”, como nas telas do aluno.
- **Busca:** só professor verificado e com horário livre, que é o que a consulta já garante.
- **Modo lista de espera:** `/buscar` fechado (404); `/professores` aberto.
- **Commits:** com as linhas de atribuição da sessão.

## Review Focus

- **Busca incompleta:** sem disciplina ou série, `/buscar` mostra o formulário com o aviso, não um erro. Teste no Task 1 (`parseSearchForm`).
- **CEP:** CEP desconhecido em aula presencial devolve “CEP não encontrado”, não uma lista vazia. Teste no Task 1.
- **Nenhum resultado:** aparece um estado vazio com sugestões (tentar online, outra série). Teste no navegador no Task 2.
- **Paginação:** “Ver mais” só aparece quando há mais resultados. Teste no Task 1.
- **Valores inválidos na URL:** `?disciplina=abc&serie=999` são ignorados como se não existissem. Teste no Task 1.

---

### Task 1: Busca — leitura do formulário e domínio

**Files:**
- Create: `src/lib/search-form.ts`, `src/domain/search/teachers.ts`
- Test: `tests/domain/search-form.test.ts`, `tests/domain/search-teachers.test.ts`

**Interfaces:**
- `parseSearchForm(p: Record<string, string | undefined>): SearchForm`, com `SearchForm = { subjectId: number | null; gradeId: number | null; modality: 'online' | 'at_student' | 'at_teacher'; cep: string; maxPriceCents: number | null; q: string; page: number }`.
  - Valores fora do catálogo viram `null`.
  - Modalidade inválida vira `'online'`.
  - `page` mínimo de 1.
- `searchTeachers(deps, form: SearchForm & { subjectId: number; gradeId: number }, now): Promise<{ ok: true; items: SearchItem[]; hasMore: boolean } | { ok: false; error: 'cep' }>`.
  - `SearchItem = { teacherId, slug, name, headline, photoUrl, minPriceCents, nextSlot, slotsWeek, rating: number | null, reviews, km: number | null }`.
  - `PAGE_SIZE = 12`.

- [ ] **Step 1:** testes de `parseSearchForm`: padrões; IDs inválidos viram `null`; `cep` só com dígitos; `preco` em reais vira centavos; `pagina` inválida vira 1.
- [ ] **Step 2:** testes de `searchTeachers` com `listedTeacher` e `refreshTeacher`:
  - item com `slug`, `photoUrl` `/api/fotos/…`, `rating: null` e `reviews: 0`;
  - preço máximo abaixo do preço tira o professor;
  - `at_student` com CEP desconhecido dá `{ ok: false, error: 'cep' }`;
  - paginação: 13 professores dão 12 itens e `hasMore: true`; na página 2, 1 item e `hasMore: false`.
- [ ] **Step 3:** rodar e ver falhar; implementar; rodar e ver passar. Comando: `npx vitest run tests/domain/search-form.test.ts tests/domain/search-teachers.test.ts`.
- [ ] **Step 4:** commit.

### Task 2: Telas — página inicial do aluno, `/buscar`, `/professores` e topo

**Files:**
- Create:
  - `src/app/(site)/professores/page.tsx`;
  - `src/components/site/WaitlistLanding.tsx` (a página atual dos professores, movida para cá);
  - `src/components/aluno/StudentHome.tsx`;
  - `src/components/aluno/SearchForm.tsx`;
  - `src/components/aluno/TeacherCard.tsx`;
  - `src/app/(aluno)/buscar/page.tsx`.
- Modify: `src/app/(site)/page.tsx` (modo completo: `StudentHome`), `src/components/site/SiteHeader.tsx` e `src/domain/site-mode.ts` (abrir `/professores`).
- Test: `tests/e2e/fluxo-completo.spec.ts` e `tests/e2e-lista/lista-de-espera.spec.ts`.

- [ ] **Step 1: testes no navegador.**
  - **Fluxo completo:** o aluno começa em `/`, escolhe Matemática, 9º ano e Online e clica em “Buscar professores”. O cartão “Ana Souza” aparece com “Perfil verificado” e “Novo na Reforce”; a busca é recarregada até o retrato da agenda ficar pronto. O clique no cartão leva ao perfil. Uma busca de Química mostra o estado vazio “Nenhum professor com horário livre”.
  - **Lista de espera:** `/professores` mostra o título dos professores, e `/buscar` responde 404.
- [ ] **Step 2:** rodar e ver falhar; implementar como descrito no design; rodar e ver passar com `npm run test:e2e`.
- [ ] **Step 3:** conferir as capturas em 390 px e no computador.
- [ ] **Step 4:** commit, documentação (README, “Produção na Railway”: `/professores` e a vitrine) e PR em rascunho.
