# Lista de espera: novo visual (direção C) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refazer a página inicial (lista de espera de professores) e a página de privacidade no visual da direção C, com perguntas frequentes, formulário em duas etapas e convite pelo WhatsApp, sem mudar o visual das telas do marketplace.

**Architecture:** Dois grupos de rotas do App Router: `(site)` (página inicial e privacidade, com topo e rodapé novos) e `(marketplace)` (todas as outras telas, com o invólucro estreito de hoje). O layout raiz só carrega as fontes e o `<body>`. O formulário continua usando a ação `joinWaitlistAction` e o domínio `joinTeacherWaitlist` sem mudança; as duas etapas são só da tela (as duas ficam no DOM, uma escondida, e o envio leva tudo).

**Tech Stack:** Next.js 16.4.6 (App Router, `proxy.ts`), React 19, Tailwind 4, `next/font/google`, `next/og`, `libphonenumber-js`, Vitest, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-11-16-lista-de-espera-visual-design.md`

## Global Constraints

- Antes de escrever código do Next, ler o guia correspondente em `node_modules/next/dist/docs/` (AGENTS.md). O antigo middleware é `src/proxy.ts`.
- Textos em português do Brasil, exatamente como neste plano e na especificação.
- Cores: `#1E1B4B` (indigo-950 do Tailwind), `#4F46E5` (indigo-600), `#FACC15` (yellow-400), `#F5F3FF` (violet-50); e as novas `site-muted #4B4880`, `site-line #E4E0FF`, `site-field #C9C4F2`, `site-on-dark #DDDBFF`.
- Letras: Space Grotesk (600 e 700) nos títulos; Inter (400, 500 e 600) no texto; ambas por `next/font/google`.
- Alvos de toque com 44 px ou mais; nenhuma rolagem lateral em 390 px de largura; contraste de texto de 4,5:1 ou mais.
- Não mudar `joinTeacherWaitlist`, a ação `joinWaitlistAction`, o campo-armadilha `website`, o consentimento nem a planilha.
- As telas do marketplace mantêm o visual atual (classes `.btn`, `.card` etc. de `globals.css` intactas).
- Não citar valor de comissão em lugar nenhum.
- Mensagens de commit terminam com as duas linhas de atribuição da sessão.

## Review Focus

- **Enter na etapa 1:** apertar Enter num campo da etapa 1 deve validar e avançar, nunca enviar o formulário incompleto. Teste no Task 4.
- **Voltar sem perder dados:** ir à etapa 2 e voltar mantém o que foi digitado, e o envio leva os campos das duas etapas. Teste no Task 4.
- **Recusa do servidor:** sem disciplina marcada, a mensagem do servidor aparece na etapa 2 e a pessoa corrige sem recomeçar; recusa de dado da etapa 1 leva de volta à etapa 1 com a mensagem. Testes nos Tasks 2 e 4.
- **Celular:** em 390 px não há rolagem lateral, e o botão do topo e os botões de marcar cabem na tela. Teste no Task 3.
- **Modo lista de espera:** as rotas do marketplace continuam respondendo 404, e a imagem de prévia e o ícone respondem 200. Testes nos Tasks 3 e 5.

---

### Task 1: Separar o site do marketplace (grupos de rotas, fontes e cores)

**Files:**
- Modify: `src/app/layout.tsx` (sem `<main>`; fontes; `metadataBase`)
- Create: `src/app/(marketplace)/layout.tsx`
- Move (git mv): `src/app/{aula,dev,interno,p,pedido,professor}` → `src/app/(marketplace)/`
- Move (git mv): `src/app/page.tsx`, `src/app/actions.ts`, `src/app/privacidade/` → `src/app/(site)/`
- Create: `src/app/(site)/layout.tsx` (por ora só repassa `children` dentro de `<div className="font-site">`)
- Modify: `src/app/globals.css`
- `src/app/api/` fica onde está.

**Interfaces:**
- Produces: utilitários Tailwind `font-site`, `font-display`, `text-site-muted`, `border-site-line`, `border-site-field`, `text-site-on-dark` (e as variantes `bg-`/`border-` correspondentes); CSS vars `--font-inter` e `--font-space-grotesk` no `<html>`.

- [ ] **Step 1: Mover as pastas** com `git mv` como acima. O import `./actions` da página inicial continua válido, porque a ação vai junto.
- [ ] **Step 2: `src/app/(marketplace)/layout.tsx`** devolve `<main className="mx-auto max-w-3xl px-4 py-8">{children}</main>`, o mesmo invólucro que hoje está no layout raiz.
- [ ] **Step 3: Layout raiz.** `Inter` e `Space_Grotesk` de `next/font/google` com `subsets: ['latin']`, `display: 'swap'` e `variable: '--font-inter'` e `'--font-space-grotesk'`; as duas classes `.variable` no `<html lang="pt-BR">`. O `<body>` recebe só `{children}`. Trocar o `metadata` estático por `generateMetadata()` que devolve o que existe hoje mais `metadataBase: new URL(process.env.APP_BASE_URL ?? 'http://localhost:3000')`. Ler `process.env` direto, porque `config()` exige `DATABASE_URL` e o layout roda no build.
- [ ] **Step 4: `globals.css`.** Acrescentar um bloco `@theme inline` com `--font-site: var(--font-inter), ui-sans-serif, system-ui, sans-serif;` e `--font-display: var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif;`. No `@theme` existente, acrescentar as quatro cores `site-*` dos Global Constraints. Não mexer em `--font-sans` nem nas classes existentes.
- [ ] **Step 5: Verificar tipos e build.**
  - Rodar `npm run typecheck && npm run build`.
  - Esperado: sem erros, e a lista de rotas do build com as mesmas URLs de antes (`/`, `/privacidade`, `/professor/entrar`, `/p/[slug]`, `/pedido/[id]`, `/aula/[token]`, `/interno`, `/dev` e as `/api/...`).
- [ ] **Step 6: Verificar o fluxo completo.**
  - Rodar `npm test && npm run test:e2e`.
  - Esperado: os testes do Vitest e o “Fluxo completo” passam como antes.
- [ ] **Step 7: Commit:** `git commit -m "Site e marketplace em grupos de rotas; fontes e cores do site"`.

---

### Task 2: Validação da etapa 1 (função pura)

**Files:**
- Create: `src/lib/waitlist-step1.ts`
- Test: `tests/domain/waitlist-step1.test.ts`

**Interfaces:**
- Produces:
  - `type Step1Field = 'name' | 'email' | 'phone' | 'city' | 'state'`
  - `step1Errors(v: Record<Step1Field, string>): Partial<Record<Step1Field, string>>`
  - `stepOfServerError(message: string): 1 | 2`
  - Sem imports do servidor (`node:*`, `@/domain/auth/codes`); pode importar `libphonenumber-js`.

- [ ] **Step 1: Escrever os testes**

```ts
import { describe, expect, it } from 'vitest';
import { step1Errors, stepOfServerError } from '@/lib/waitlist-step1';

const ok = { name: 'Bruna Lima', email: 'bruna@exemplo.com', phone: '', city: 'Campinas', state: 'sp' };

describe('etapa 1 da lista de espera', () => {
  it('aceita dados válidos, com WhatsApp vazio ou válido', () => {
    expect(step1Errors(ok)).toEqual({});
    expect(step1Errors({ ...ok, phone: '(11) 98888-7777' })).toEqual({});
  });
  it('mostra as mesmas mensagens do servidor', () => {
    expect(step1Errors({ name: ' Ab ', email: 'x@y', phone: '123', city: 'A', state: 'S1' })).toEqual({
      name: 'informe seu nome completo',
      email: 'e-mail inválido',
      phone: 'telefone inválido: informe DDD e número',
      city: 'informe sua cidade',
      state: 'UF inválida',
    });
  });
  it('sabe em que etapa está o erro do servidor', () => {
    for (const m of ['informe seu nome completo', 'e-mail inválido', 'telefone inválido: informe DDD e número', 'informe sua cidade', 'UF inválida']) {
      expect(stepOfServerError(m)).toBe(1);
    }
    expect(stepOfServerError('escolha ao menos uma disciplina da lista')).toBe(2);
    expect(stepOfServerError('Algo deu errado. Tente de novo em instantes.')).toBe(2);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.** `npx vitest run tests/domain/waitlist-step1.test.ts`. Esperado: falha porque o módulo não existe.
- [ ] **Step 3: Implementar `src/lib/waitlist-step1.ts`**, espelhando `joinTeacherWaitlist`:
  - nome aparado com 3 a 120 caracteres;
  - e-mail aparado e minúsculo contra `/^[^@\s]+@[^@\s]+\.[^@\s]+$/`;
  - telefone só se preenchido, com `parsePhoneNumberFromString(v, 'BR')?.isValid()`;
  - cidade aparada com 2 a 80 caracteres;
  - UF aparada e em maiúsculas contra `/^[A-Z]{2}$/`.
  - `stepOfServerError` devolve 1 quando a mensagem é uma das cinco mensagens da etapa 1, e 2 em qualquer outro caso.
- [ ] **Step 4: Rodar e ver passar.** O mesmo comando. Esperado: 3 testes passam.
- [ ] **Step 5: Commit:** `git commit -m "Validação da etapa 1 da lista de espera"`.

---

### Task 3: Página da lista de espera (topo, seções, perguntas, rodapé e privacidade) e teste no navegador em modo lista de espera

**Files:**
- Create: `src/components/site/content.ts` (textos abaixo)
- Create: `src/components/site/{SiteHeader,SiteFooter,Hero,Steps,Benefits,Faq}.tsx` (componentes do servidor)
- Modify: `src/app/(site)/layout.tsx` (topo e rodapé em volta de `children`; `metadata` do site)
- Modify: `src/app/(site)/page.tsx` (modo `lista_de_espera`: `Hero`, `Steps`, `Benefits`, `Faq` e a seção `#lista` com o `WaitlistForm` atual por enquanto; modo `completo`: o conteúdo de hoje dentro de `mx-auto max-w-3xl px-4 py-8`)
- Modify: `src/app/(site)/privacidade/page.tsx` (só classes; o texto não muda)
- Create: `playwright.lista.config.ts`, `tests/e2e-lista/global-setup.ts`, `tests/e2e-lista/lista-de-espera.spec.ts`
- Modify: `package.json` (`"test:e2e": "playwright test && playwright test -c playwright.lista.config.ts"`)

**Interfaces:**
- Consumes: utilitários do Task 1.
- Produces:
  - `SiteHeader()`: faixa `bg-indigo-950`; “Reforce” em `font-display` com link para `/`; botão amarelo “Quero dar aula” com link para `/#lista`.
  - `SiteFooter()`: faixa `bg-indigo-950`; o texto “Reforce · aulas particulares com professores verificados” e um link para `/privacidade`.
  - Seção do formulário: `<section id="lista">`.
  - Ambiente de teste do modo lista de espera: porta 3201 e banco `aulas_e2e_lista`.

- [ ] **Step 1: Montar o ambiente de teste do modo lista de espera.**
  - `playwright.lista.config.ts` copia `playwright.config.ts` e muda:
    - `testDir: 'tests/e2e-lista'`;
    - `globalSetup: './tests/e2e-lista/global-setup.ts'`;
    - `baseURL: 'http://localhost:3201'`;
    - um único `webServer` com `npx next dev -p 3201`, `url: 'http://localhost:3201/api/saude'` e `env`.
  - O `env` tem `DATABASE_URL` (o banco `aulas_e2e_lista`, na mesma instância do `E2E_DATABASE_URL`), `APP_BASE_URL: 'http://localhost:3201'`, `SITE_MODE: 'lista_de_espera'`, `WAITLIST_EXPORT_PASSWORD: 'senha-de-teste-bem-longa'` e `NEXT_TELEMETRY_DISABLED: '1'`.
  - O `global-setup.ts` recria o banco, roda `migrate` e `seed`, como o de `tests/e2e`, mas sem worker.
  - Os dois `next dev` rodam um depois do outro (o script usa `&&`), nunca juntos.
- [ ] **Step 2: Escrever o teste da página** em `tests/e2e-lista/lista-de-espera.spec.ts`

```ts
test('página da lista de espera: seções, perguntas e celular', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ensine. A cobrança é com a gente.');
  for (const h of ['Quatro passos até a primeira aula paga', 'Você cuida da aula. O resto é automático.', 'Perguntas frequentes', 'Garanta seu lugar entre os primeiros']) {
    await expect(page.getByRole('heading', { name: h })).toBeVisible();
  }
  await expect(page.locator('details')).toHaveCount(8);
  await page.getByText('Preciso ter CNPJ?').click();
  await expect(page.getByText('Dá para receber como pessoa física')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.goto('/privacidade');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Política de privacidade da lista de espera');
  expect((await request.get('/professor/entrar')).status()).toBe(404);
});
```

- [ ] **Step 3: Rodar e ver falhar.** `npx playwright test -c playwright.lista.config.ts`. Esperado: falha no título.
- [ ] **Step 4: Escrever `content.ts`** com estes textos exatos:

```ts
export const HERO = {
  badge: 'Lista de espera aberta para os primeiros professores',
  titleBefore: 'Ensine. ', titleMark: 'A cobrança', titleAfter: ' é com a gente.',
  lead: 'Monte sua agenda, divulgue sua página e receba depois de cada aula. Matemática, Física, Química e Redação, do 6º ano ao ensino médio.',
  primary: 'Entrar na lista de espera', secondary: 'Como funciona',
  examples: [
    { title: 'Reserva confirmada', text: 'Ter, 15:00 · Matemática online · pago por PIX' },
    { title: 'Lembrete enviado à família', text: '24 h antes, por WhatsApp e e-mail' },
    { title: 'Aula concluída', text: 'O valor foi liberado para você' },
  ],
};
export const STEPS_TITLE = 'Quatro passos até a primeira aula paga';
export const STEPS = [
  { title: 'Entre na lista', text: 'Leva poucos minutos. Avisamos quando a seleção abrir na sua cidade e disciplina.' },
  { title: 'Seja verificado', text: 'Envie identidade, certidão de antecedentes e comprovante de formação. A equipe aprova seu perfil.' },
  { title: 'Monte sua agenda', text: 'Seus horários, o seu preço e onde dá aula: online, na casa do aluno ou no seu endereço.' },
  { title: 'Dê a aula e receba', text: 'A família paga na reserva. Depois da aula, o valor é liberado para você.' },
];
export const BENEFITS_TITLE = 'Você cuida da aula. O resto é automático.';
export const BENEFITS = [
  { icon: 'link', title: 'Sua página, seus horários', text: 'Um link só seu, com os horários livres de verdade. Mande no grupo da escola ou no seu Instagram.' },
  { icon: 'card', title: 'Sem cobrar ninguém', text: 'A família paga por PIX ou cartão na reserva. Acabou o constrangimento de lembrar o pagamento.' },
  { icon: 'check', title: 'Aluno faltou, aula paga', text: 'O valor fica guardado e é liberado depois da aula, mesmo que o aluno não apareça.' },
  { icon: 'shield', title: 'Selo de verificado', text: 'Identidade, antecedentes criminais e formação conferidos. Os pais confiam mais, e você se destaca.' },
  { icon: 'video', title: 'Sala de aula online própria', text: 'A aula online acontece dentro da Reforce, direto no navegador: sem Zoom, sem Meet e sem instalar nada. Prefere presencial? Na casa do aluno ou no seu endereço, com o deslocamento já contado na agenda.' },
  { icon: 'bell', title: 'Ninguém esquece a aula', text: 'Confirmação e lembretes 24 h e 1 h antes, por WhatsApp e e-mail, para você e para a família.' },
] as const;
export const FAQ_TITLE = 'Perguntas frequentes';
export const FAQ = [/* as oito perguntas e respostas da especificação, na mesma ordem, em { q, a } */];
export const FORM_TITLE = 'Garanta seu lugar entre os primeiros';
export const FORM_LEAD = 'Sem custo e sem compromisso. Avisamos por e-mail e WhatsApp quando abrirmos a seleção na sua região e disciplina.';
```

- [ ] **Step 5: Implementar os componentes e as páginas.**
  - **Abertura** (`bg-indigo-950 text-white`):
    - o selo;
    - o `<h1>` em `font-display`, com `<mark>` amarelo em “A cobrança”;
    - o texto de abertura em `text-site-on-dark`;
    - os botões com link para `#lista` e `#como`;
    - os três exemplos como lista de cartões brancos, com `aria-label="Exemplo do que você recebe"`.
  - **Passos** (`id="como"`): número `01`–`04` em `font-display` e `text-indigo-600`.
  - **Vantagens** (`bg-violet-50`): cartões brancos com ícone em quadrado `bg-indigo-600`. Os ícones são SVGs de traço, com `aria-hidden`: link, cartão, círculo com visto, escudo, câmera e sino.
  - **Perguntas:**
    - `<details className="group">` com `<summary>` de 44 px de altura mínima ou mais;
    - o marcador nativo escondido (`list-none` e `[&::-webkit-details-marker]:hidden`);
    - o “+” gira com `group-open:rotate-45`.
  - **Seção `#lista`:** fundo `bg-indigo-950`, título, texto e o formulário.
  - **Grades:** `grid-cols-[repeat(auto-fit,minmax(230px,1fr))]`, ou as faixas `sm:`/`lg:`, de modo que nada passe de 390 px.
  - **Privacidade:** a mesma `article`, em `mx-auto max-w-3xl px-5 py-12`, com títulos em `font-display` e links `text-indigo-600`.
  - **`metadata` do `(site)/layout.tsx`:**
    - `title: 'Reforce · Lista de espera de professores'`;
    - `description: 'Ensine. A cobrança é com a gente. Página própria, agenda, cobrança por PIX ou cartão e sala de aula online. Entre na lista de espera dos primeiros professores.'`;
    - `openGraph` com o mesmo título e a mesma descrição, `siteName: 'Reforce'`, `locale: 'pt_BR'` e `type: 'website'`.
- [ ] **Step 6: Rodar e ver passar.** `npx playwright test -c playwright.lista.config.ts`. Esperado: o teste passa.
- [ ] **Step 7: Conferir o visual.** Tirar capturas em 390 e 1280 px, com `deviceScaleFactor` 1, e comparar com a maquete da direção C (`docs/superpowers/specs/…`, seção Design).
- [ ] **Step 8: Commit:** `git commit -m "Página da lista de espera no visual da direção C"`.

---

### Task 4: Formulário em duas etapas com convite pelo WhatsApp

**Files:**
- Move and rewrite: `src/components/WaitlistForm.tsx` → `src/components/site/WaitlistForm.tsx`
- Modify: `src/app/(site)/page.tsx` (novo import; passa `inviteUrl={config().appBaseUrl}`)
- Test: `tests/e2e-lista/lista-de-espera.spec.ts` (novo teste)

**Interfaces:**
- Consumes:
  - `step1Errors` e `stepOfServerError` (Task 2);
  - `joinWaitlistAction(prev, f: FormData): Promise<ActionState<{ created: boolean }>>` (já existe).
- Produces: `WaitlistForm({ action, subjects, stages, modalities, education, inviteUrl }: { …Option[]…; inviteUrl: string })`.

- [ ] **Step 1: Escrever o teste do fluxo**

```ts
test('formulário em duas etapas: Enter avança, Voltar mantém, erro do servidor, convite e planilha', async ({ page, browser }) => {
  await page.goto('/#lista');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('informe seu nome completo')).toBeVisible();
  await page.getByLabel('Nome completo').fill('Bruna Lima');
  await page.getByLabel('E-mail').fill('bruna.lista@exemplo.com');
  await page.getByLabel('WhatsApp (opcional)').fill('(21) 98888-7777');
  await page.getByLabel('Cidade').fill('Rio de Janeiro');
  await page.getByLabel('UF').fill('rj');
  await page.getByLabel('UF').press('Enter');
  await expect(page.getByText('Etapa 2 de 2 · Suas aulas')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.getByLabel('Nome completo')).toHaveValue('Bruna Lima');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Ensino médio').check();
  await page.getByLabel('Online').check();
  await page.getByLabel('Formação').selectOption('licenciatura');
  await page.getByLabel(/Autorizo o contato/).check();
  await page.getByRole('button', { name: 'Entrar na lista de espera' }).click();
  await expect(page.getByRole('alert')).toHaveText('escolha ao menos uma disciplina da lista');
  await page.getByLabel('Matemática').check();
  await page.getByRole('button', { name: 'Entrar na lista de espera' }).click();
  const ok = page.getByTestId('lista-ok');
  await expect(ok).toContainText('Inscrição recebida!');
  const invite = ok.getByRole('link', { name: 'Convidar pelo WhatsApp' });
  expect(decodeURIComponent((await invite.getAttribute('href'))!)).toContain('http://localhost:3201');
  const ctx = await browser.newContext({ httpCredentials: { username: 'equipe', password: 'senha-de-teste-bem-longa' } });
  const csv = await (await ctx.request.get('/api/lista-de-espera.csv')).text();
  expect(csv).toContain('bruna.lista@exemplo.com');
});
```

- [ ] **Step 2: Rodar e ver falhar.** `npx playwright test -c playwright.lista.config.ts -g "duas etapas"`. Esperado: falha porque o botão “Continuar” não existe.
- [ ] **Step 3: Reescrever o `WaitlistForm`.**
  - **Estrutura e estado:**
    - um único `<form action={run}>`;
    - estado `step: 1 | 2` e `fieldErrors` da etapa 1;
    - as duas etapas sempre no DOM, a inativa com o atributo `hidden`;
    - campos de entrada nunca desativados, para o envio levar tudo.
  - **Cabeçalho de cada etapa:** “Etapa 1 de 2 · Seus dados” ou “Etapa 2 de 2 · Suas aulas”, como título com `tabIndex={-1}` (recebe o foco ao trocar de etapa), e duas barras de progresso.
  - **Etapa 1:**
    - campos “Nome completo”, “E-mail”, “WhatsApp (opcional)”, “Cidade” e “UF”, com os mesmos `name` e `autoComplete` de hoje e `maxLength={2}` na UF;
    - botão “Continuar” (`type="button"`);
    - o texto “Na próxima etapa: disciplinas, etapas e formação.”.
  - **Continuar e Enter:** “Continuar” lê os campos do `form`, aplica `step1Errors` e, se houver erro, mostra a mensagem abaixo do campo (`aria-invalid`, `aria-describedby`) e põe o foco no primeiro campo inválido. Senão, vai para a etapa 2. Enter (`onKeyDown`) num campo da etapa 1 faz `preventDefault` e o mesmo que “Continuar”.
  - **Etapa 2:**
    - grupos “Disciplinas”, “Etapas” e “Modalidade”, de caixas de marcar em forma de pílula de 44 px de altura, com `has-checked:border-indigo-600 has-checked:bg-indigo-50`;
    - “Formação” como `select`;
    - “Conte um pouco da sua experiência (opcional)”;
    - o consentimento com o texto e o link de hoje;
    - o campo-armadilha de hoje;
    - botões “Voltar” e “Entrar na lista de espera” (`type="submit"`, “Enviando…” enquanto espera).
  - **Erro do servidor:** `<p role="alert">`. Se `stepOfServerError(error) === 1`, ele vai para a etapa 1 e aparece lá; senão, fica na etapa 2.
  - **Sucesso:**
    - cartão com `data-testid="lista-ok"` e `role="status"`;
    - título “Inscrição recebida!”;
    - o texto atual de novo cadastro ou de dados atualizados;
    - “Conhece outro professor que ia gostar?”;
    - o link “Convidar pelo WhatsApp”, para `https://wa.me/?text=` mais `encodeURIComponent('Estou na lista de espera da Reforce, plataforma de aulas particulares que cuida da agenda e da cobrança. Entra também: ' + inviteUrl)`, com `target="_blank"` e `rel="noreferrer"`.
- [ ] **Step 4: Rodar e ver passar.** `npx playwright test -c playwright.lista.config.ts`. Esperado: os dois testes passam.
- [ ] **Step 5: Commit:** `git commit -m "Formulário da lista de espera em duas etapas, com convite pelo WhatsApp"`.

---

### Task 5: Prévia do link, ícone e publicação

**Files:**
- Create: `src/app/opengraph-image.tsx`, `src/app/icon.svg`
- Modify: `src/domain/site-mode.ts`, `tests/domain/site-mode.test.ts`, `tests/e2e-lista/lista-de-espera.spec.ts`
- Modify: `docs/pendencias.md`, `README.md`

**Interfaces:**
- Consumes: `isPathOpenInWaitlistMode(pathname)` (já existe).

- [ ] **Step 1: Escrever os testes.**
  - Em `site-mode.test.ts`, acrescentar `'/opengraph-image'` e `'/icon.svg'` à lista de caminhos abertos. A lista de fechados continua igual.
  - Em `lista-de-espera.spec.ts`, novo teste: abrir `/`, ler `meta[property="og:image"]` e `link[rel="icon"]` e, para cada um, buscar o caminho com `request.get`. Esperado: 200, `content-type` `image/png` para a prévia e `image/svg+xml` para o ícone.
- [ ] **Step 2: Rodar e ver falhar.**
  - Rodar `npx vitest run tests/domain/site-mode.test.ts && npx playwright test -c playwright.lista.config.ts -g "prévia"`.
  - Esperado: os dois falham.
- [ ] **Step 3: Implementar.**
  - **`src/app/opengraph-image.tsx`:** `ImageResponse` de `next/og`, com `size` 1200×630, `contentType: 'image/png'` e `alt: 'Reforce: lista de espera de professores'`. A imagem tem fundo `#1E1B4B`, o nome “Reforce”, o título “Ensine. A cobrança é com a gente.” com “A cobrança” em `#FACC15` e o selo da abertura.
  - **`src/app/icon.svg`:** quadrado arredondado `#1E1B4B` com um “R” em `#FACC15`.
  - **`OPEN` em `site-mode.ts`:** acrescentar `'/opengraph-image'` e `'/icon.svg'`. Se o build gerar outro caminho (com sufixo), ajustar para o caminho real, que o teste no navegador confere.
- [ ] **Step 4: Rodar e ver passar.**
  - Rodar o mesmo comando do Step 2, depois `npm run check && npm run build && npm run test:e2e`.
  - Esperado: tudo passa.
- [ ] **Step 5: Documentação.**
  - **`docs/pendencias.md`, item “Hospedagem”:** `APP_BASE_URL=https://reforce.up.railway.app` até o domínio ficar pronto; depois, voltar para `https://reforce.app.br`.
  - **README, passo 3 da Railway:** a mesma observação.
- [ ] **Step 6: Commit:** `git commit -m "Prévia do link no WhatsApp, ícone e documentação"`.
- [ ] **Step 7: Publicar.**
  - Enviar a branch e abrir o PR em rascunho.
  - Antes do merge, gravar `APP_BASE_URL=https://reforce.up.railway.app` na Railway pela API (`variableUpsert`), que vale no próximo deploy.
  - O merge espera o pedido do usuário.
