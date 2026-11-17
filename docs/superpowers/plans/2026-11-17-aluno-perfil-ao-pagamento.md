# Aluno: do perfil ao pagamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Foto do professor (envio, análise e exibição) e o caminho do aluno — perfil, reserva, pagamento, confirmação e página da aula — no visual da direção C.

**Architecture:**
- **Foto:** fica no PostgreSQL, numa tabela própria, já processada pelo `sharp` (quadrado de 512 px, WEBP, sem metadados). A rota pública `/api/fotos/<id>` serve só fotos aprovadas.
- **Telas do aluno:** vão para o grupo de rotas `(aluno)`, com o topo e o rodapé do site.
- **O que não muda:** os painéis do professor e da equipe continuam em `(marketplace)` com o visual de hoje e ganham só as seções da foto. As regras de reserva e de pagamento não mudam.

**Tech Stack:** Next.js 16.4.6, React 19, Tailwind 4, Kysely, PostgreSQL 16, `sharp` 0.35, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-aluno-perfil-ao-pagamento-design.md`. As maquetes (canvas “Reforce: maquetes”, página “Aluno”, telas 1 a 6) são a referência visual e de textos. As cópias ficam em `/tmp/claude-0/-home-user-reforce-app/15e0e200-0a64-5594-aa37-60154dd8f9bd/scratchpad/canvas-reforce/project/F1…F6`.

## Global Constraints

- **Next:** ler o guia em `node_modules/next/dist/docs/` antes de escrever código do Next.
- **Visual:** o mesmo da lista de espera.
  - Cores: `indigo-950`, `indigo-600`, `yellow-400`, `violet-50` e os tokens `site-*`.
  - Letras: `font-display` (Space Grotesk) nos títulos e `font-site` (Inter) no texto.
  - Alvos de toque de 44 px ou mais; nada passa de 390 px de largura.
- **Textos:** “aluno” no lugar de “família”; “adulto responsável” onde a regra exige.
- **Selo:** o texto é exatamente **“Perfil verificado”**.
- **O que não muda:** as regras de reserva, de pagamento, de repasse e de notificação; os nomes dos campos dos formulários de reserva; as ações do servidor de hoje.
- **O que nunca aparece:**
  - telefone, e-mail, endereço ou dados de recebimento do professor no perfil;
  - foto não aprovada fora dos painéis do professor dono e da equipe;
  - metadados (EXIF, GPS) na foto guardada.
- **Modo lista de espera:** `/api/fotos/*` e as telas do aluno continuam fechadas (o `proxy.ts` já fecha tudo que não está liberado).
- **Commits:** terminam com as duas linhas de atribuição da sessão.

## Review Focus

- **Foto deitada:** foto de celular com orientação no EXIF deve sair em pé, não deitada. Teste no Task 1.
- **Imagem gigante:** imagem de muitos pixels em poucos megabytes (por exemplo, PNG de 12.000 × 12.000) deve ser recusada com mensagem clara, sem derrubar o servidor. Teste no Task 1.
- **Foto só em análise:** um professor com foto em análise e nenhuma aprovada aparece com as iniciais, e a rota pública responde 404 para a foto em análise. Testes nos Tasks 1 e 2.
- **Aluno em outro fuso:** dias e horários do perfil seguem o fuso de quem vê. A faixa de dias usa `groupByViewerDate`, e o link de reserva leva o instante exato. Teste no Task 4.
- **Nome com vírgula no calendário:** nome do professor ou disciplina com vírgula, ponto e vírgula ou acento não quebra o arquivo de calendário. Teste no Task 7.

---

### Task 1: Foto do professor — banco e domínio

**Files:**
- Create: `db/migrations/0009_fotos.sql`, `src/domain/teachers/photo.ts`
- Modify: `src/domain/staff/review.ts` (`approveTeacher` exige foto aprovada; `reviewQueue` inclui foto em análise)
- Modify: `package.json` (`sharp` como dependência direta, `0.35.5`)
- Modify: `tests/helpers/scenario.ts` (`listedTeacher` grava uma foto aprovada)
- Test: `tests/domain/teacher-photo.test.ts`, `tests/domain/staff-review.test.ts`

**Interfaces:**
- **Banco:** tabela `teacher_photos` com:
  - `id uuid PK`;
  - `teacher_id uuid NOT NULL REFERENCES teachers`;
  - `image bytea NOT NULL`;
  - `width int`, `height int`;
  - `status text CHECK IN ('pending','approved','rejected','replaced')`;
  - `created_at timestamptz DEFAULT now()`;
  - `decided_at timestamptz`, `decided_by uuid REFERENCES staff_users`, `decision_note text`.

  Índices únicos parciais: no máximo uma `pending` e uma `approved` por professor.
- **Produces:**
  - `processPhoto(bytes: Uint8Array, contentType: string): Promise<{ bytes: Uint8Array; width: number; height: number }>`
  - `submitTeacherPhoto(deps: Deps, teacherId: string, file: UploadedFile, now: Temporal.Instant): Promise<{ photoId: string }>`
  - `decideTeacherPhoto(deps: Deps, input: { photoId: string; staffId: string; approve: boolean; note?: string }, now): Promise<void>`
  - `teacherPhotoState(deps, teacherId): Promise<{ approvedId: string | null; pending: { id: string; dataUrl: string } | null; approvedDataUrl: string | null; rejectedNote: string | null }>`
  - `publicPhotoBytes(deps, photoId): Promise<Uint8Array | null>` (só `approved`)
  - `QueueItem` ganha `photo: { id: string; dataUrl: string; status: 'pending' | 'approved' } | null`.

- [ ] **Step 1: Escrever os testes** em `tests/domain/teacher-photo.test.ts`. Usam imagens geradas com `sharp` no próprio teste.
  - `remove metadados e endireita`: uma entrada JPEG 400×300 com `withMetadata({ orientation: 6, exif: { IFD0: { Copyright: 'x' } } })` sai WEBP 512×512, sem `exif` nem `orientation`. O pixel do topo da entrada, pintado de vermelho antes de girar, fica no lado certo depois da rotação.
  - `recusa formato, tamanho e pixels demais`:
    - `image/gif` → `formatos aceitos: JPG, PNG ou WEBP`;
    - 5 MB + 1 byte → `a foto pode ter até 5 MB`;
    - PNG de 12000×12000 → `a foto é grande demais; envie uma de até 40 megapixels`.
  - `nova foto substitui a em análise; aprovar troca a aprovada`: duas submissões deixam uma `pending` (a primeira vira `replaced`). Aprovar a segunda depois de já haver uma aprovada deixa a antiga `replaced`.
  - `rota pública só vê aprovada`: `publicPhotoBytes` é `null` para `pending` e `rejected`.
  - `recusa guarda o motivo e avisa por e-mail`: `rejectedNote` vem preenchido, e há um e-mail no `dev_outbox` com o motivo.
  - Em `staff-review.test.ts`: `approveTeacher` sem foto aprovada rejeita com `/foto/`. Com foto aprovada, aprova como hoje (ajustar os testes existentes para gravar a foto antes).
- [ ] **Step 2: Rodar e ver falhar.** `npx vitest run tests/domain/teacher-photo.test.ts tests/domain/staff-review.test.ts`. Esperado: falha porque o módulo não existe.
- [ ] **Step 3: Implementar.**
  - Migração `0009`.
  - `processPhoto`:
    - `sharp(bytes, { limitInputPixels: 40_000_000 })`;
    - `.rotate()`, que endireita pelo EXIF antes de descartá-lo;
    - `.resize(512, 512, { fit: 'cover', position: 'attention' })`;
    - `.webp({ quality: 82 })`, sem `withMetadata`;
    - o erro de limite de pixels vira `DomainError` com a mensagem do teste.
  - Envio e decisão: em transação.
  - Recusa: avisa o professor por e-mail, no mesmo formato de `notifyTeacher`.
  - `approveTeacher`: exige `approvedId` antes de aprovar, com a mensagem `aprove a foto do professor antes do perfil`.
  - `listedTeacher`: insere uma foto `approved`, gerada com `sharp`.
- [ ] **Step 4: Rodar e ver passar.** O comando do Step 2 e depois `npm test`. Esperado: tudo passa.
- [ ] **Step 5: Commit:** `git commit -m "Foto do professor: banco, processamento e análise"`.

---

### Task 2: Foto — painel do professor, painel da equipe e rota pública

**Files:**
- Create: `src/app/api/fotos/[id]/route.ts`
- Modify: `src/app/(marketplace)/professor/cadastro/page.tsx` e `src/app/(marketplace)/professor/actions.ts` (`uploadPhotoAction`)
- Modify: `src/app/(marketplace)/interno/verificacoes/page.tsx` e `src/app/(marketplace)/interno/actions.ts` (`decidePhotoAction`)
- Create: `tests/e2e/fixtures/foto.jpg` (JPEG de cerca de 600×800 gerado com `sharp`, com EXIF)
- Modify: `tests/e2e/fluxo-completo.spec.ts`

**Interfaces:**
- **Consumes:** Task 1.
- **Produces:** a rota GET `/api/fotos/<id>`, que responde 200 `image/webp` com `Cache-Control: public, max-age=31536000, immutable` para foto aprovada, e 404 em qualquer outro caso.

- [ ] **Step 1: Ajustar o fluxo completo para usar a foto.**
  - Depois de salvar o perfil, a professora envia a foto em `data-testid="foto"` (`input[type=file]` mais o botão “Enviar foto”) e vê “Em análise”.
  - Na fila da equipe, `queue.getByTestId('foto')` mostra a foto e o botão “Aprovar foto”. Depois de clicar, aparece “Aprovada”.
  - Só então a equipe clica em “Aprovar perfil”.
  - Teste novo no mesmo arquivo: a URL da foto (`/api/fotos/<id>`, lida do `<img>` do perfil) responde 200 `image/webp`. Antes da aprovação, a mesma rota com o id em análise responde 404.
- [ ] **Step 2: Rodar e ver falhar.** `npx playwright test --trace off`. Esperado: falha porque não existe a seção da foto.
- [ ] **Step 3: Implementar.**
  - **Seção “Sua foto” no cadastro:**
    - prévia da aprovada e/ou da em análise, por `dataUrl`;
    - situação: “Em análise”, “Aprovada” ou “Recusada: <motivo>”;
    - `accept="image/jpeg,image/png,image/webp"`;
    - o texto “Uma foto do rosto, de frente e com boa luz. A equipe confere com o seu documento de identidade.”.
  - **Bloco `data-testid="foto"` em cada item da fila da equipe:** a foto ao lado dos links do documento de identidade, com “Aprovar foto” e “Recusar foto” (campo de motivo obrigatório na recusa).
  - **Rota:** usa `publicPhotoBytes`.
- [ ] **Step 4: Rodar e ver passar.** `npm run test:e2e`. Esperado: os dois arquivos passam.
- [ ] **Step 5: Commit:** `git commit -m "Foto do professor: envio no painel, análise da equipe e rota pública"`.

---

### Task 3: Base das telas do aluno

**Files:**
- Move (git mv): `src/app/(marketplace)/{p,pedido,aula}` → `src/app/(aluno)/`
- Create: `src/app/(aluno)/layout.tsx`. Usa `SiteHeader` sem o botão “Quero dar aula” e `SiteFooter`, dentro de `font-site bg-white text-indigo-950`, com `<main className="mx-auto w-full max-w-2xl px-5 pb-28 pt-6">`.
- Modify: `src/components/site/SiteHeader.tsx` (prop `cta?: boolean`, padrão `true`) e `src/components/BookingForm.tsx` (caminho do import das ações)
- Create em `src/components/aluno/`:
  - `TeacherPhoto.tsx`: `{ photoUrl, name, size }`; mostra a foto ou as iniciais num quadrado arredondado `bg-site-line`.
  - `Stepper.tsx`: `{ current: 1 | 2 | 3 }`, com “Horário”, “Seus dados” e “Pagamento”.
  - `LessonSummary.tsx`: `{ photoUrl, teacherName, subject, when, extra, priceCents }`.
  - `ProtectedNote.tsx`: `{ title, children }`, o quadro lilás com o escudo.

**Interfaces:**
- **Produces:** os quatro componentes acima e o grupo `(aluno)`.

- [ ] **Step 1:** mover as pastas, criar o layout e os componentes, e ajustar o import. A rota e a URL não mudam.
- [ ] **Step 2: Verificar.** `npm run typecheck && npm run build`. Esperado: as rotas `/p/[slug]`, `/p/[slug]/reservar`, `/pedido/[id]`, `/pedido/[id]/confirmado` e `/aula/[token]` continuam na lista.
- [ ] **Step 3: Commit:** `git commit -m "Telas do aluno em grupo próprio, com topo e rodapé do site"`.

---

### Task 4: Perfil do professor

**Files:**
- Modify: `src/domain/public/teacher-page.ts`, `src/app/(aluno)/p/[slug]/page.tsx`
- Replace: `src/components/SlotPicker.tsx` → `src/components/aluno/ProfileBooking.tsx`
- Test: `tests/domain/public-page.test.ts`, `tests/e2e/fluxo-completo.spec.ts`

**Interfaces:**
- **Produces:** `PublicTeacherPage` ganha:
  - `photoUrl: string | null` (`/api/fotos/<id>`);
  - `verified: boolean` (`sellable && badges.length === 3`);
  - `minPriceCents: number | null`;
  - `modalities: Array<'online' | 'at_teacher' | 'at_student'>`;
  - `nextSlot: string | null` (o menor instante entre todos os serviços).
- **Produces:** `ProfileBooking({ slug, teacherTz, services })`, componente do cliente.

- [ ] **Step 1: Testes.**
  - Em `public-page.test.ts`, `mostra perfil…`:
    - `photoUrl` casa com `/^\/api\/fotos\//`, `verified` é `true`, `minPriceCents` é `12100` e `nextSlot` é `TUE_14.toString()`;
    - com a foto aprovada trocada por uma `pending`, `photoUrl` vira `null`.
  - No fluxo completo, o trecho do aluno passa a ser:
    - `getByText('Perfil verificado')` visível;
    - o cartão `getByRole('radio', { name: /online/i })`;
    - o primeiro botão `[data-slot]`;
    - o link “Reservar”, de onde se lê `href` e `data-slot`.
  - Teste rápido novo (`tests/domain/profile-days.test.ts`): `groupByViewerDate`, aplicado aos horários de um professor em São Paulo e visto de `Europe/Lisbon`, agrupa pela data de Lisboa. Uma aula às 22:00 de terça em São Paulo aparece na quarta.
- [ ] **Step 2: Rodar e ver falhar.** `npx vitest run tests/domain/public-page.test.ts tests/domain/profile-days.test.ts`. Esperado: falha nos campos novos.
- [ ] **Step 3: Implementar o perfil como na tela 1.**
  - Foto, nome, selo “Perfil verificado” e frase de apresentação.
  - `<details>` “O que verificamos”, com “Identidade conferida”, “Certidão de antecedentes criminais, válida até dd/mm/aaaa” e “Formação conferida”.
  - Três números rápidos:
    - “A partir de” e o preço;
    - “Aulas”, com “Online”, “Na sua casa” e “No endereço do professor”, juntados por “e”;
    - “Próximo horário”, no fuso de quem vê.
  - “Dá aula de”, “Sobre”, “Escolha a aula” (cartões `role="radio"`) e “Horários livres”:
    - faixa de dias com `aria-pressed`;
    - grade de horários, botões com `data-slot`;
    - o texto “no seu horário”.
  - `ProtectedNote` “Sua aula protegida”, com os três parágrafos da tela 1.
  - Link “É aluno? Mande para seu responsável”, com o texto de WhatsApp de hoje.
  - Barra fixa (`fixed inset-x-0 bottom-0`) com o dia e a hora escolhidos, “R$ X · N min” e o link “Reservar”, para `/p/<slug>/reservar?servico=…&inicio=…`, desativado até escolher o horário.
  - Sem venda: aviso “Agenda indisponível no momento.”.
- [ ] **Step 4: Rodar e ver passar.** `npx vitest run tests/domain && npm run test:e2e`. Esperado: tudo passa.
- [ ] **Step 5: Commit:** `git commit -m "Perfil do professor no visual novo, com foto e selo Perfil verificado"`.

---

### Task 5: Reserva — seus dados e código

**Files:**
- Modify: `src/app/(aluno)/p/[slug]/reservar/page.tsx`, `src/components/BookingForm.tsx`
- Test: `tests/e2e/fluxo-completo.spec.ts`

- [ ] **Step 1: Teste.** No fluxo completo, o aluno que pega horário ocupado vê `getByTestId('ocupado')` com “acabou de ser reservado” no lugar de `.error`. Rodar e ver falhar.
- [ ] **Step 2: Implementar como nas telas 2 e 3.**
  - **Topo:** link “← <nome>” de volta ao perfil, `Stepper current={2}` e `LessonSummary`.
  - **Título e formulário:**
    - “Quem está reservando?”, com o texto do adulto responsável e “Não precisa de senha.”;
    - os campos de hoje, com os mesmos `name`;
    - endereço só no serviço na casa do aluno.
  - **Etapa do código:** título “Confira seu e-mail”, campo `#code` grande, botão “Confirmar e reservar o horário”, e “Trocar e-mail”, que recarrega a página.
  - **Responsável identificado:** escolha do aluno e do endereço, no visual novo.
  - **Horário ocupado:** caixa `role="alert" data-testid="ocupado"` com a mensagem e os horários mais próximos.
- [ ] **Step 3: Rodar e ver passar.** `npm run test:e2e`.
- [ ] **Step 4: Commit:** `git commit -m "Reserva no visual novo: seus dados e código"`.

---

### Task 6: Pagamento

**Files:**
- Modify: `src/app/(aluno)/pedido/[id]/page.tsx`, `src/components/Countdown.tsx`
- Create: `src/components/aluno/CopyButton.tsx`
- Test: `tests/e2e/fluxo-completo.spec.ts`

- [ ] **Step 1: Teste.**
  - No fluxo completo, `getByTestId('cronometro')` contém “guardado”.
  - Depois de “Pagar com PIX”, o botão “Copiar código PIX” fica visível.
  - Rodar e ver falhar.
- [ ] **Step 2: Implementar como na tela 4.**
  - **Faixa e resumo:**
    - faixa `bg-yellow-400` fixa no topo, com “Horário guardado para você por mm:ss” (`data-testid="cronometro"`);
    - `Stepper current={3}` e `LessonSummary` (“para <aluno>”);
    - “Como você quer pagar?”.
  - **Escolha da forma de pagamento:** sem cobrança criada, dois cartões grandes, “PIX” e “Cartão de crédito”, que disparam a ação de hoje (os rótulos “Pagar com PIX” e “Pagar com cartão” ficam como nome acessível).
  - **PIX criado:**
    - QR grande em `data-testid="pix"`;
    - `CopyButton`, que mostra “Código copiado” por 2 segundos;
    - a validade;
    - “Trocar para cartão”.
  - **Avisos e estados:**
    - “Assim que o pagamento cair, esta página avança sozinha.”;
    - `ProtectedNote` “Pagamento protegido”;
    - expirada: a mensagem atual e o link “Escolher outro horário” para o perfil;
    - o botão “Simular pagamento” do modo de testes continua.
- [ ] **Step 3: Rodar e ver passar.** `npm run test:e2e`.
- [ ] **Step 4: Commit:** `git commit -m "Pagamento no visual novo, com PIX fácil de copiar"`.

---

### Task 7: Aula confirmada, arquivo de calendário e página da aula

**Files:**
- Create: `src/domain/lessons/ics.ts`, `src/app/(aluno)/pedido/[id]/agenda.ics/route.ts`
- Create: `src/components/aluno/RoomCountdown.tsx`
- Modify: `src/app/(aluno)/pedido/[id]/confirmado/page.tsx`, `src/app/(aluno)/aula/[token]/page.tsx`
- Test: `tests/domain/lesson-ics.test.ts`, `tests/e2e/fluxo-completo.spec.ts`

**Interfaces:**
- **Produces:** `lessonIcs(input: { uid: string; startsAt: Temporal.Instant; endsAt: Temporal.Instant; summary: string; description: string; location: string; now: Temporal.Instant }): string`.
- **Produces:** a rota GET `/pedido/<id>/agenda.ics`. Exige que o responsável dono do pedido esteja identificado (a mesma checagem de `orderView`) e que a aula esteja confirmada. Responde `text/calendar; charset=utf-8` com `Content-Disposition: attachment; filename="aula-reforce.ics"`.

- [ ] **Step 1: Testes.**
  - `lesson-ics.test.ts`:
    - linhas terminam em `\r\n`;
    - `DTSTART:20261118T180000Z`;
    - vírgula, ponto e vírgula e barra invertida escapados no `SUMMARY`;
    - linha de mais de 75 bytes dobrada com espaço;
    - acentos preservados em UTF-8;
    - `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID:-//Reforce//Aulas//PT-BR`, `METHOD:PUBLISH`.
  - No fluxo completo:
    - `getByTestId('aula-confirmada')` com “Aula confirmada!”;
    - o link “Adicionar à minha agenda” baixa um arquivo com `BEGIN:VCALENDAR`;
    - na página da aula, o botão continua “Entrar na aula”.
- [ ] **Step 2: Rodar e ver falhar.** `npx vitest run tests/domain/lesson-ics.test.ts`.
- [ ] **Step 3: Implementar como nas telas 5 e 6.**
  - **Aula confirmada:**
    - cartão com a data em destaque e o horário no fuso do responsável;
    - foto, “<disciplina> com <professor>” e “Aluno: <nome>, <série>”;
    - a modalidade;
    - os botões “Ir para a página da aula” e “Adicionar à minha agenda”;
    - “No dia da aula”, com três itens;
    - `ProtectedNote`: “Se o professor não entrar na sala em até 15 minutos, o dinheiro volta inteiro, sem precisar pedir.”;
    - “Marcar a próxima aula com <primeiro nome>”;
    - aula presencial: endereço e código, como hoje.
  - **Página da aula:**
    - `RoomCountdown` até `startsAt − 10 min`, que chama `router.refresh()` quando zera;
    - com a sala aberta, o botão “Entrar na aula” de hoje;
    - as três dicas;
    - aula presencial: código e endereço em destaque;
    - aula inativa: o aviso de hoje.
  - **`DESCRIPTION` do calendário:** o link da página da aula, de `src/domain/lessons/links.ts`.
- [ ] **Step 4: Rodar e ver passar.** `npm run check && npm run build && npm run test:e2e`.
- [ ] **Step 5: Documentação.**
  - README, roteiro com adaptadores falsos: o passo da foto, entre o perfil e os documentos.
  - `docs/pendencias.md`: a foto fica no banco; com milhares de professores, mudar para armazenamento de arquivos.
- [ ] **Step 6: Commit:** `git commit -m "Aula confirmada com arquivo de calendário e página da aula no visual novo"`.
- [ ] **Step 7: Publicar.** Enviar a branch e abrir o PR em rascunho. O merge espera o pedido do usuário.
