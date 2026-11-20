/**
 * Fluxo completo da Fase 1 com os adaptadores falsos, web e worker reais:
 * professora se cadastra, é aprovada no painel e configura a agenda; uma
 * família abre o link, reserva, "paga" e recebe a confirmação; uma segunda
 * família não consegue o mesmo horário; a aula acontece na sala falsa, é
 * concluída e o repasse é liberado 24 h depois. Nenhuma reserva duplicada.
 */
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import pg from 'pg';
import { E2E_DATABASE_URL, STAFF_EMAIL } from './env';

const FIXTURES = path.resolve('tests/e2e/fixtures');
const TEACHER_EMAIL = 'ana.e2e@exemplo.com';
const SLUG = 'ana-matematica';

let db: pg.Client;
test.beforeAll(async () => {
  db = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await db.connect();
});
test.afterAll(async () => {
  await db.end();
});

const q = async (text: string, params: unknown[] = []) => (await db.query(text, params)).rows;

/** Código mais recente enviado para o e-mail (caixa de saída de desenvolvimento). */
async function lastCode(email: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const rows = await q(`SELECT body FROM dev_outbox WHERE recipient = $1 AND subject LIKE 'Seu código%' ORDER BY id DESC LIMIT 1`, [email]);
    const m = /\b(\d{6})\b/.exec(rows[0]?.body ?? '');
    if (m) return m[1]!;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`nenhum código para ${email}`);
}

async function codeLogin(page: Page, path: string, email: string) {
  await page.goto(path);
  const before = (await q(`SELECT count(*)::int AS n FROM dev_outbox WHERE recipient = $1`, [email]))[0]!.n;
  await page.fill('#email', email);
  await page.click('button:has-text("Receber código por e-mail")');
  await page.waitForSelector('#code');
  await expect.poll(async () => (await q(`SELECT count(*)::int AS n FROM dev_outbox WHERE recipient = $1`, [email]))[0]!.n)
    .toBeGreaterThan(before);
  await page.fill('#code', await lastCode(email));
  await page.click('button:has-text("Entrar")');
}

/** Ajusta o relógio de desenvolvimento (compartilhado por web e worker) para o instante dado. */
/** O professor começou a dar aula em 2013; a página mostra os anos até hoje. */
const EXPERIENCE = `${new Date().getFullYear() - 2013} anos de experiência`;

async function setClock(target: Date) {
  const offset = target.getTime() - Date.now();
  await q(`INSERT INTO dev_clock (id, offset_ms) VALUES (true, $1)
           ON CONFLICT (id) DO UPDATE SET offset_ms = EXCLUDED.offset_ms`, [offset]);
}

async function runSweeps(browser: Browser) {
  const page = await browser.newPage();
  await page.goto('/dev');
  await page.click('button:has-text("Rodar varreduras agora")');
  await expect(page.getByText('Varreduras executadas.')).toBeVisible({ timeout: 90_000 });
  await page.close();
}

async function identifyAndReserve(page: Page, slotUrl: string, who: { email: string; phone: string }) {
  await page.goto(slotUrl);
  // a série vem da busca (ou a única do professor) e o aceite do WhatsApp começa desmarcado
  await expect(page.locator('select[name=studentGrade]')).toHaveValue('9ano');
  await expect(page.locator('input[name=whatsappOptIn]')).not.toBeChecked();
  await page.check('input[name=whatsappOptIn]');
  await page.fill('input[name=name]', 'Maria Lima');
  await page.fill('input[name=phone]', who.phone);
  await page.fill('input[name=email]', who.email);
  await page.fill('input[name=studentFirstName]', 'Joana');
  await page.selectOption('select[name=studentGrade]', '9ano');
  await page.click('button:has-text("Continuar")');
  await page.waitForSelector('#code');
  await page.fill('#code', await lastCode(who.email));
  await page.click('button:has-text("Confirmar e reservar")');
}

test('fluxo completo: cadastro, aprovação, agenda, reserva, pagamento, aula e repasse', async ({ browser }) => {
  // 1. A professora se cadastra, envia documentos, abre a conta de recebimento e pede análise.
  const teacher = await (await browser.newContext()).newPage();
  await codeLogin(teacher, '/professor/entrar', TEACHER_EMAIL);
  // primeiro acesso: só o nome, depois o Início com os passos
  await teacher.waitForURL('**/professor/boas-vindas');
  await expect(teacher.getByRole('heading', { level: 1 })).toHaveText('Como você quer ser chamado?');
  await teacher.fill('#nome', 'Ana Souza');
  await teacher.getByRole('button', { name: 'Continuar' }).click();
  await teacher.waitForURL(/\/professor$/);
  await expect(teacher.getByRole('heading', { level: 1 })).toHaveText('Olá, Ana');
  // cada passo é clicável na linha inteira
  await expect(teacher.getByTestId('passo-perfil').getByRole('link')).toHaveAttribute('href', '/professor/cadastro');
  await teacher.goto('/professor/cadastro');
  // a área do professor tem o menu do painel, com a página atual marcada
  const nav = teacher.getByRole('navigation', { name: 'Área do professor' });
  for (const label of ['Início', 'Meu perfil', 'Serviços e preços', 'Agenda', 'Aulas', 'Documentos', 'Recebimento']) {
    await expect(nav.getByRole('link', { name: label })).toBeVisible();
  }
  await expect(nav.getByRole('link', { name: 'Meu perfil' })).toHaveAttribute('aria-current', 'page');
  // a prévia mostra, ao vivo, como os alunos vão ver a página
  const preview = teacher.getByTestId('previa');
  await expect(preview).toContainText('Defina o preço em Serviços e preços');
  await teacher.fill('#displayName', 'Ana Souza');
  await teacher.fill('#slug', SLUG);
  await teacher.fill('#headline', 'Matemática para o 9º ano');
  await expect(preview).toContainText('Matemática para o 9º ano');
  await teacher.getByRole('checkbox', { name: 'ENEM' }).check();
  await teacher.fill('#teachingSince', '2013');
  await expect(preview).toContainText('ENEM');
  await expect(preview).toContainText(EXPERIENCE);
  // o formulário em seções; as séries em fichas grandes, por disciplina
  for (const h of ['Sua página', 'O que você ensina', 'Contato', 'Aula presencial']) {
    await expect(teacher.getByRole('heading', { name: h, exact: true })).toBeVisible();
  }
  expect((await teacher.locator('label:has(input[aria-label="Matemática, 9º ano"])').boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await teacher.getByRole('button', { name: 'Marcar todas as séries de Física' }).click();
  await expect(teacher.locator('input[name=subj][aria-label^="Física,"]:checked')).toHaveCount(8);
  await teacher.getByRole('button', { name: 'Desmarcar as séries de Física' }).click();
  await expect(teacher.locator('input[name=subj][aria-label^="Física,"]:checked')).toHaveCount(0);
  await teacher.check('input[aria-label="Matemática, 9º ano"]');
  await teacher.fill('#phone', '(11) 97777-6666');
  await teacher.check('input[name=whatsappOptIn]');
  await teacher.fill('#baseCep', '01310-100');
  await teacher.fill('#travelRadiusKm', '5');
  await teacher.fill('#teachingAddress', 'Rua das Flores, 100, Pinheiros');
  await teacher.click('button:has-text("Salvar perfil")');
  await expect(teacher.getByText('Perfil salvo.')).toBeVisible();
  // telefone e raio voltam no formato brasileiro
  await teacher.reload();
  await expect(teacher.locator('#phone')).toHaveValue('(11) 97777-6666');
  await expect(teacher.locator('#travelRadiusKm')).toHaveValue('5');
  await teacher.setViewportSize({ width: 390, height: 844 }); // no celular, o editor e a prévia cabem sem rolagem lateral
  expect(await teacher.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  // no celular, um atalho leva à prévia, que fica no fim da página
  await expect(teacher.getByRole('link', { name: 'Ver como os alunos veem' })).toHaveAttribute('href', '#previa');
  await teacher.setViewportSize({ width: 1280, height: 720 });
  await expect(teacher.getByRole('link', { name: 'Ver como os alunos veem' })).toBeHidden();
  const photoForm = teacher.getByTestId('foto');
  expect((await photoForm.locator('input[type=file]').boundingBox())!.height).toBeGreaterThanOrEqual(44); // botão de arquivo grande
  await photoForm.locator('input[type=file]').setInputFiles(path.join(FIXTURES, 'foto.jpg'));
  await photoForm.locator('button:has-text("Enviar foto")').click();
  await expect(photoForm.getByText('Em análise')).toBeVisible();

  await teacher.goto('/professor/verificacao');
  expect(await teacher.getByTestId('verificacao-criminal_record').locator('h2').innerText()).toBe('Antecedentes criminais');
  const docs: Array<[string, string[]]> = [
    ['identity', ['documento.pdf', 'selfie.pdf']], ['criminal_record', ['documento.pdf']], ['education', ['documento.pdf']],
  ];
  for (const [kind, files] of docs) {
    const section = teacher.locator(`[data-testid=verificacao-${kind}]`);
    expect((await section.locator('input[type=file]').boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await section.locator('input[type=file]').setInputFiles(files.map((f) => path.join(FIXTURES, f)));
    await section.locator('button:has-text("Enviar")').click();
    await expect(section.getByText('Em análise')).toBeVisible();
  }

  await teacher.goto('/professor/recebimento');
  const account: Record<string, string> = {
    name: 'Ana Souza', cpfCnpj: '529.982.247-25', birthDate: '1990-05-10', email: TEACHER_EMAIL, phone: '11977776666',
    postalCode: '01310100', address: 'Av. Paulista', addressNumber: '1000', income: '5000',
  };
  for (const [id, v] of Object.entries(account)) await teacher.fill(`#${id}`, v);
  await teacher.click('button:has-text("Abrir conta")');
  await expect(teacher.getByTestId('conta-status')).toContainText('ativa');

  await teacher.goto('/professor');
  await teacher.setViewportSize({ width: 390, height: 844 }); // no celular, o menu não cria rolagem lateral
  expect(await teacher.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  // no celular, a barra de baixo tem Início, Aulas, Mensagens, Agenda e "Mais" com o resto
  const tabs = teacher.getByRole('navigation', { name: 'Área do professor' });
  for (const l of ['Início', 'Aulas', 'Mensagens', 'Agenda']) await expect(tabs.getByRole('link', { name: l })).toBeVisible();
  await expect(tabs.getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page');
  await tabs.getByRole('button', { name: 'Mais' }).click();
  for (const l of ['Meu perfil', 'Serviços e preços', 'Documentos', 'Recebimento']) await expect(tabs.getByRole('link', { name: l })).toBeVisible();
  await tabs.getByRole('button', { name: 'Mais' }).click();
  await teacher.setViewportSize({ width: 1280, height: 720 });
  // o painel Início mostra os passos feitos (foto em análise, perfil, documentos e conta) e que a página ainda não está no ar
  await expect(teacher.getByRole('heading', { level: 1 })).toHaveText('Olá, Ana');
  await expect(teacher.getByTestId('progresso')).toHaveText('4 de 7');
  await expect(teacher.getByTestId('passo-foto')).toContainText('Em análise');
  await expect(teacher.getByTestId('pagina-aviso')).toBeVisible();
  await teacher.click('button:has-text("Enviar para análise")');
  await expect(teacher.getByTestId('teacher-status')).toHaveText('Em análise pela equipe');

  // 2. A equipe aprova os três documentos e o perfil.
  const staff = await (await browser.newContext()).newPage();
  await codeLogin(staff, '/interno/entrar', STAFF_EMAIL);
  await staff.waitForURL('**/interno');
  // o painel da equipe tem o molde da área do professor: topo com "Sair", menu lateral e, no celular, barra embaixo
  const staffNav = staff.getByRole('navigation', { name: 'Painel da equipe' });
  for (const label of ['Início', 'Verificações', 'Aulas', 'Professores', 'Reembolsos']) {
    await expect(staffNav.getByRole('link', { name: label })).toBeVisible();
  }
  await expect(staffNav.getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page');
  await expect(staff.getByRole('button', { name: 'Sair' })).toBeVisible();
  await staff.setViewportSize({ width: 390, height: 844 });
  expect(await staff.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(staffNav.getByRole('link', { name: 'Verificações' })).toBeVisible(); // na barra de baixo
  await staff.setViewportSize({ width: 1280, height: 720 });
  await staff.goto('/interno/verificacoes');
  const queue = staff.getByTestId(`fila-${SLUG}`);
  for (const kind of ['identity', 'criminal_record', 'education']) {
    const doc = queue.getByTestId(`doc-${kind}`);
    await doc.locator('button:has-text("Aprovar")').click();
    await expect(doc.getByText('Aprovado')).toBeVisible();
  }
  // a foto: a equipe compara com o documento; antes da aprovação, a rota pública não a entrega
  const photoBox = queue.getByTestId('foto');
  await expect(photoBox.locator('img')).toBeVisible();
  const photoId = (await q(`SELECT id FROM teacher_photos WHERE status = 'pending'`))[0]!.id as string;
  expect((await staff.request.get(`/api/fotos/${photoId}`)).status()).toBe(404);
  await photoBox.locator('button:has-text("Aprovar foto")').click();
  await expect(photoBox.getByText('Aprovada')).toBeVisible();
  const publicPhoto = await staff.request.get(`/api/fotos/${photoId}`);
  expect(publicPhoto.status()).toBe(200);
  expect(publicPhoto.headers()['content-type']).toBe('image/webp');
  await queue.locator('button:has-text("Aprovar perfil")').click();
  await expect.poll(async () => (await q(`SELECT status FROM teachers WHERE slug = $1`, [SLUG]))[0]!.status).toBe('approved');
  expect(await q(`SELECT count(*)::int AS n FROM teachers_listed`)).toEqual([{ n: 1 }]);
  // Professores: a professora aparece em "Aprovado"; a aba "Em análise" fica vazia
  await staff.getByRole('navigation', { name: 'Painel da equipe' }).getByRole('link', { name: 'Professores' }).click();
  await staff.waitForURL('**/interno/professores');
  await expect(staff.getByTestId(`professor-${SLUG}`)).toContainText('Aprovado');
  await staff.getByRole('navigation', { name: 'Situação' }).getByRole('link', { name: /Em análise/ }).click();
  await staff.waitForURL('**/interno/professores?situacao=in_review');
  await expect(staff.getByTestId(`professor-${SLUG}`)).toHaveCount(0);
  await expect(staff.getByText('Nenhum professor nesta situação.')).toBeVisible();
  // Reembolsos: nenhum pedido devolvido ainda
  await staff.goto('/interno/reembolsos');
  await expect(staff.getByText('Nenhum reembolso ainda.')).toBeVisible();

  // 3. A professora configura serviços e agenda.
  await teacher.goto('/professor/servicos');
  await expect(teacher.getByRole('heading', { level: 1 })).toHaveText('Serviços e preços');
  // enquanto digita o preço, o professor vê quanto recebe pelo link dele (5%) e pela busca (15%)
  await teacher.fill('input[name=price]', '121,00');
  await expect(teacher.getByTestId('voce-recebe')).toHaveText('Você recebe R$ 114,95 pelo seu link e R$ 102,85 pela busca.');
  await teacher.click('button:has-text("Criar serviço")');
  await expect(teacher.getByText('Serviço criado.')).toBeVisible();
  await teacher.getByRole('radio', { name: 'Na casa do aluno' }).check();
  await expect(teacher.getByLabel('Deslocamento')).toHaveValue('30');
  await teacher.fill('input[name=price]', '150,00');
  await teacher.click('button:has-text("Criar serviço")');
  const services = teacher.getByTestId('servicos');
  await expect(services).toContainText('Na casa do aluno');
  await expect(services).toContainText('Deslocamento: 30 min antes e depois');
  // pausar é uma ação secundária e dá para reativar
  const atHome = services.getByRole('listitem').filter({ hasText: 'Na casa do aluno' });
  await atHome.getByRole('button', { name: 'Pausar' }).click();
  await expect(atHome).toContainText('Pausado');
  await atHome.getByRole('button', { name: 'Reativar' }).click();
  await expect(atHome.getByRole('button', { name: 'Pausar' })).toBeVisible();

  await teacher.goto('/professor/agenda');
  await expect(teacher.getByText('horário de São Paulo')).toBeVisible();
  // a semana inteira de uma vez: o início digitado ("8h") e o fim escolhido na lista
  await teacher.getByRole('button', { name: '+ Adicionar horários' }).click();
  await teacher.getByRole('button', { name: 'Todos os dias' }).click();
  await teacher.getByLabel('Das', { exact: true }).fill('8h');
  await teacher.getByRole('button', { name: 'Escolher até na lista' }).click();
  await teacher.getByRole('option', { name: '21:00' }).click();
  await teacher.getByRole('button', { name: 'Adicionar em 7 dias' }).click();
  const week = teacher.getByTestId('semana');
  await expect(week.getByText('08:00 – 21:00')).toHaveCount(7);
  // remover mostra "Desfazer", que devolve o horário
  await week.getByRole('button', { name: 'Remover domingo, 08:00 às 21:00' }).click();
  await expect(week.getByText('08:00 – 21:00')).toHaveCount(6);
  await teacher.getByRole('button', { name: 'Desfazer' }).click();
  await expect(week.getByText('08:00 – 21:00')).toHaveCount(7);
  // folga de dia inteiro daqui a 40 dias, longe das aulas do teste
  const dayOff = new Date(Date.now() + 40 * 24 * 60 * 60_000).toISOString().slice(0, 10);
  await teacher.getByRole('button', { name: '+ Folga ou horário extra' }).click();
  await teacher.getByLabel('Dia', { exact: true }).fill(dayOff);
  await teacher.getByRole('radio', { name: 'Bloquear o dia todo' }).check();
  await teacher.getByRole('button', { name: 'Salvar folga' }).click();
  await expect(teacher.getByTestId('folgas')).toContainText('dia todo');
  // regras de reserva em frases
  await teacher.locator('#minNoticeMin').selectOption('120');
  await teacher.getByRole('button', { name: 'Salvar regras' }).click();
  await expect(teacher.getByText('Regras salvas.')).toBeVisible();
  // "Como os alunos veem": o calendário do mês
  await expect(teacher.getByRole('group', { name: 'Dias do mês' })).toBeVisible();
  await teacher.setViewportSize({ width: 390, height: 844 }); // no celular, a Agenda cabe sem rolagem lateral
  expect(await teacher.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await teacher.setViewportSize({ width: 1280, height: 720 });
  // aprovada, com serviço e agenda: os sete passos feitos e o link da página para divulgar
  await teacher.goto('/professor');
  await expect(teacher.getByTestId('progresso')).toHaveText('7 de 7');
  // com tudo pronto, o Início fica enxuto: "Tudo pronto" e as próximas aulas antes dos passos
  await expect(teacher.getByText('Tudo pronto: sua página está no ar.')).toBeVisible();
  const top = async (l: Locator) => (await l.boundingBox())!.y;
  expect(await top(teacher.getByRole('heading', { name: 'Próximas aulas' }))).toBeLessThan(await top(teacher.getByText('Ver os passos')));
  await expect(teacher.getByTestId('pagina-link')).toHaveAttribute('href', new RegExp(`/p/${SLUG}$`));

  // 4. Uma família abre o link, reserva o primeiro horário online e paga por PIX (simulado).
  const fam1 = await (await browser.newContext()).newPage();
  // a vitrine: sem professor de Química, estado vazio; com Matemática, a professora aparece
  await fam1.goto('/buscar?disciplina=3&serie=9&modalidade=online');
  await expect(fam1.getByText('Nenhum professor com horário livre')).toBeVisible();
  await fam1.goto('/');
  await fam1.getByLabel('Disciplina').selectOption({ label: 'Matemática' });
  await fam1.getByLabel('Série').selectOption({ label: '9º ano' });
  await fam1.getByRole('radio', { name: 'Online' }).check();
  await fam1.getByRole('button', { name: 'Buscar professores' }).click();
  await fam1.waitForURL('**/buscar?**');
  const card = fam1.getByRole('link', { name: /Ana Souza/ });
  await expect.poll(async () => {
    if ((await card.count()) > 0) return true;
    await fam1.reload(); // o retrato da agenda é refeito pelo worker logo depois da configuração
    return false;
  }, { timeout: 60_000 }).toBe(true);
  await expect(card).toContainText('Perfil verificado');
  await expect(card).toContainText('Novo na Reforce');
  await card.click();
  await fam1.waitForURL(`**/p/${SLUG}?serie=9ano&origem=busca`); // o perfil guarda a série buscada e a origem
  await expect(fam1.getByText('Perfil verificado')).toBeVisible();
  // rótulos do resumo do perfil legíveis (antes, 12 px)
  expect(await fam1.getByText('A partir de', { exact: true }).first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize)))
    .toBeGreaterThanOrEqual(13);
  await expect(fam1.getByText('ENEM', { exact: true })).toBeVisible();
  await expect(fam1.getByText(EXPERIENCE)).toBeVisible();
  await expect(fam1.getByRole('img', { name: 'Foto de Ana Souza' })).toBeVisible();
  await fam1.getByRole('radio', { name: /online/i }).click();
  // o mês todo: o calendário mostra, em cada dia, quantos horários livres ele tem
  const monthDays = fam1.getByRole('group', { name: 'Dias do mês' });
  await expect(monthDays).toBeVisible();
  await expect(fam1.getByText(/^(Janeiro|Fevereiro|Março|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro) de \d{4}$/)).toBeVisible();
  await expect(monthDays.getByRole('button', { name: /\d+ horários? livres?$/ }).first()).toBeVisible();
  const slotButton = fam1.locator('button[data-slot]').first();
  const slotInstant = (await slotButton.getAttribute('data-slot'))!;
  await slotButton.click();
  const reserve = fam1.getByRole('link', { name: 'Reservar' });
  const slotUrl = new URL((await reserve.getAttribute('href'))!, fam1.url()).toString();
  expect(slotUrl).toContain(encodeURIComponent(slotInstant));
  expect(slotUrl).toContain('serie=9ano'); // a série buscada segue até a reserva
  // no computador, duas colunas: o cartão com a aula, os horários e "Reservar" fica fixo à direita do perfil
  const about = fam1.getByRole('heading', { name: 'Dá aula de', exact: true });
  const bookingCard = fam1.getByTestId('cartao-reserva');
  const bookingBar = fam1.getByTestId('barra-reservar');
  const box = async (l: typeof about) => (await l.boundingBox())!;
  expect((await box(bookingCard)).x).toBeGreaterThan((await box(about)).x + (await box(about)).width);
  expect(await bookingCard.evaluate((e) => getComputedStyle(e).position)).toBe('sticky');
  expect(await bookingBar.evaluate((e) => getComputedStyle(e).position)).not.toBe('fixed');
  // mesmo com muitos horários no dia, "Reservar" fica dentro da tela (o cartão rola por dentro)
  const reserveBox = await box(fam1.getByRole('link', { name: 'Reservar' }));
  expect(reserveBox.y + reserveBox.height).toBeLessThanOrEqual(720);
  // no celular, uma coluna: a reserva vem depois do perfil e a barra fica fixa embaixo
  await fam1.setViewportSize({ width: 390, height: 844 });
  expect((await box(bookingCard)).y).toBeGreaterThan((await box(about)).y);
  expect(await bookingBar.evaluate((e) => getComputedStyle(e).position)).toBe('fixed');
  expect(await fam1.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await fam1.setViewportSize({ width: 1280, height: 720 });

  await identifyAndReserve(fam1, slotUrl, { email: 'maria.e2e@exemplo.com', phone: '(11) 98888-1111' });
  await fam1.waitForURL('**/pedido/**');
  await expect(fam1.getByTestId('cronometro')).toContainText('guardado');
  await fam1.getByRole('button', { name: 'Pagar com PIX' }).click();
  await expect(fam1.getByTestId('pix').locator('img')).toBeVisible();
  await expect(fam1.getByRole('button', { name: 'Copiar código PIX' })).toBeVisible();
  // no computador o QR vem primeiro; no celular, quem paga no mesmo aparelho usa o "copia e cola", que vem antes
  const qrImg = fam1.getByTestId('pix').locator('img');
  const copyPix = fam1.getByRole('button', { name: 'Copiar código PIX' });
  expect(await top(qrImg)).toBeLessThan(await top(copyPix));
  await fam1.setViewportSize({ width: 390, height: 844 });
  expect(await top(copyPix)).toBeLessThan(await top(qrImg));
  await fam1.setViewportSize({ width: 1280, height: 720 });
  // com o relógio do aparelho 2 h atrasado, o cronômetro ainda mostra no máximo os 10 minutos da reserva
  const skewed = await browser.newContext();
  await skewed.addCookies(await fam1.context().cookies());
  const skewedPage = await skewed.newPage();
  await skewedPage.clock.install({ time: new Date(Date.now() - 2 * 60 * 60_000) });
  await skewedPage.goto(fam1.url());
  await expect(skewedPage.getByTestId('cronometro')).toHaveText(/por (10:00|[0-9]:[0-5][0-9])$/);
  await skewed.close();
  await fam1.click('button:has-text("Simular pagamento")');
  await fam1.waitForURL('**/confirmado');
  await expect(fam1.getByTestId('aula-confirmada')).toHaveText('Aula confirmada!');
  const icsHref = (await fam1.getByRole('link', { name: 'Adicionar à minha agenda' }).getAttribute('href'))!;
  const ics = await fam1.request.get(new URL(icsHref, fam1.url()).toString());
  expect(ics.status()).toBe(200);
  expect(ics.headers()['content-type']).toContain('text/calendar');
  expect(await ics.text()).toContain('BEGIN:VCALENDAR');

  const [booking] = await q(
    `SELECT b.id, b.starts_at, b.ends_at, b.status FROM bookings b JOIN teachers t ON t.id = b.teacher_id
      WHERE t.slug = $1 AND b.status = 'confirmed'`, [SLUG],
  );
  expect(booking).toBeTruthy();
  expect((booking!.starts_at as Date).toISOString().replace('.000', '')).toBe(slotInstant);

  // confirmação por WhatsApp e e-mail para a família e para a professora; lembretes agendados
  await runSweeps(browser);
  const outbox = await q(`SELECT channel, recipient, coalesce(template, subject) AS what FROM dev_outbox`);
  const has = (channel: string, recipient: string, what: RegExp) =>
    outbox.some((m) => m.channel === channel && m.recipient === recipient && what.test(m.what));
  expect(has('whatsapp', '+5511988881111', /confirmacao_responsavel/)).toBe(true);
  expect(has('email', 'maria.e2e@exemplo.com', /Aula confirmada/)).toBe(true);
  expect(has('whatsapp', '+5511977776666', /confirmacao_professor/)).toBe(true);
  expect(has('email', TEACHER_EMAIL, /Nova aula paga/)).toBe(true);
  const reminders = await q(`SELECT template, status FROM notifications WHERE booking_id = $1 AND template LIKE 'lembrete%'`, [booking!.id]);
  expect(reminders.length).toBeGreaterThanOrEqual(2);
  expect(reminders.every((r) => r.status === 'scheduled')).toBe(true);

  // 5. Uma segunda família tenta o mesmo horário: recebe "ocupado", nunca um QR.
  const fam2 = await (await browser.newContext()).newPage();
  await identifyAndReserve(fam2, slotUrl, { email: 'outra.e2e@exemplo.com', phone: '(11) 98888-2222' });
  await expect(fam2.getByTestId('ocupado')).toContainText('acabou de ser reservado');
  await expect(fam2.getByTestId('pix')).toHaveCount(0);

  // 6. A aula acontece: professora e aluno entram na sala (falsa) no horário.
  const startsAt = booking!.starts_at as Date;
  const endsAt = booking!.ends_at as Date;
  await setClock(new Date(startsAt.getTime() - 5 * 60_000));
  // no dia da aula, a equipe a vê em "Aulas de hoje"
  await staff.goto('/interno/aulas');
  await expect(staff.getByTestId(`hoje-${booking!.id}`)).toContainText('Ana Souza');
  await expect(staff.getByTestId(`hoje-${booking!.id}`)).toContainText('Confirmada');

  // a aula marcada fica em "Próximas" (aba aberta por padrão), com a contagem na aba
  await teacher.goto('/professor/aulas');
  const lessonTabs = teacher.getByRole('navigation', { name: 'Aulas' });
  await expect(lessonTabs.getByRole('link', { name: /Próximas/ })).toHaveAttribute('aria-current', 'page');
  await expect(lessonTabs.getByRole('link', { name: /Próximas/ })).toContainText('1');
  await teacher.getByTestId(`aula-${booking!.id}`).locator('button:has-text("Entrar na sala")').click();
  await teacher.waitForURL('**/dev/sala/**');
  await teacher.click('button:has-text("Entrar")');
  await expect(teacher.getByTestId('presenca')).toHaveText('Presença registrada na sala.');

  const lessonMail = (await q(
    `SELECT body FROM dev_outbox WHERE recipient = 'maria.e2e@exemplo.com' AND subject LIKE 'Aula confirmada%' ORDER BY id LIMIT 1`,
  ))[0]!.body as string;
  const lessonUrl = /(http:\/\/\S+\/aula\/\S+)/.exec(lessonMail)![1]!;
  await fam1.goto(lessonUrl);
  await fam1.click('button:has-text("Entrar na aula")');
  await fam1.waitForURL('**/dev/sala/**');
  await fam1.click('button:has-text("Entrar")');
  await expect(fam1.getByTestId('presenca')).toHaveText('Presença registrada na sala.');

  // 7. Passado o fim da aula, as varreduras concluem a aula e criam o repasse retido.
  await setClock(new Date(endsAt.getTime() + 11 * 60_000));
  await runSweeps(browser);
  expect(await q(`SELECT status FROM bookings WHERE id = $1`, [booking!.id])).toEqual([{ status: 'completed' }]);
  expect(await q(
    `SELECT gross_cents, commission_bps, platform_cents, teacher_cents, status FROM payouts WHERE booking_id = $1`, [booking!.id],
  )).toEqual([{ gross_cents: 12100, commission_bps: 1500, platform_cents: 1815, teacher_cents: 10285, status: 'held' }]); // veio da busca: 15%
  // concluída, a aula sai de "Próximas" e vai para "Anteriores"
  await teacher.goto('/professor/aulas');
  await expect(teacher.getByTestId(`aula-${booking!.id}`)).toHaveCount(0);
  await expect(teacher.getByText('Nenhuma aula marcada por enquanto.')).toBeVisible();
  await teacher.getByRole('navigation', { name: 'Aulas' }).getByRole('link', { name: /Anteriores/ }).click();
  await teacher.waitForURL('**/professor/aulas?aba=anteriores');
  await expect(teacher.getByTestId(`aula-${booking!.id}`).getByTestId('situacao')).toHaveText('Concluída');
  // "Meus ganhos": a parte da professora fica a receber até a liberação
  await teacher.goto('/professor/recebimento');
  await expect(teacher.getByTestId('ganho-a-receber')).toContainText('R$ 102,85');
  await expect(teacher.getByTestId(`repasse-${booking!.id}`)).toContainText('A receber');

  // 7b. Em "Minha conta" (entrada por código, sem senha), a responsável avalia a aula concluída;
  // a avaliação aparece no perfil com o autor abreviado, o telefone oculto e sem o nome da aluna.
  // O botão "Entrar" do topo leva ao login; já conectada, o topo mostra "Minha conta".
  const acct = await (await browser.newContext()).newPage();
  await acct.goto('/');
  await acct.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Entrar' }).click();
  await acct.waitForURL('**/conta/entrar');
  await acct.fill('#email', 'maria.e2e@exemplo.com');
  await acct.click('button:has-text("Receber código por e-mail")');
  await acct.waitForSelector('#code');
  await acct.fill('#code', await lastCode('maria.e2e@exemplo.com'));
  await acct.click('button:has-text("Entrar")');
  await acct.waitForURL(/\/conta$/);
  // a conta tem o molde da área do professor: topo com "Sair" e menu com Início, Aulas, Alunos e Meus dados
  const accNav = acct.getByRole('navigation', { name: 'Minha conta' });
  for (const label of ['Início', 'Aulas', 'Alunos', 'Meus dados']) await expect(accNav.getByRole('link', { name: label })).toBeVisible();
  await expect(accNav.getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page');
  await expect(acct.getByRole('button', { name: 'Sair' })).toBeVisible();
  await expect(acct.getByTestId('cartao-alunos')).toContainText('Joana');
  await acct.setViewportSize({ width: 390, height: 844 }); // no celular, o menu vai para baixo, sem rolagem lateral
  expect(await acct.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(accNav.getByRole('link', { name: 'Meus dados' })).toBeVisible();
  await acct.setViewportSize({ width: 1280, height: 720 });
  // já conectada, o topo do site mostra "Minha conta"
  await acct.goto('/');
  await expect(acct.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Minha conta' })).toHaveAttribute('href', '/conta');
  await acct.goto('/conta');
  // o Início avisa da aula esperando avaliação e leva direto a ela
  const toReview = acct.getByTestId('cartao-avaliar');
  await expect(toReview).toContainText('1 aula esperando sua avaliação');
  await toReview.getByRole('link').click();
  await acct.waitForURL(`**/conta/avaliar/${booking!.id}`);
  await acct.getByRole('radio', { name: /^5 —/ }).check({ force: true });
  await acct.fill('textarea[name=comment]', 'Explica com calma. Meu WhatsApp é 11 98888-1111');
  await acct.click('button:has-text("Enviar avaliação")');
  await acct.waitForURL('**/conta/aulas?aba=anteriores&avaliada=1');
  await expect(acct.getByText('Obrigado pela avaliação!')).toBeVisible();
  await expect(acct.getByTestId(`aula-${booking!.id}`)).toContainText('Sua avaliação');
  await acct.getByRole('navigation', { name: 'Minha conta' }).getByRole('link', { name: 'Início' }).click();
  await expect(acct.getByTestId('cartao-avaliar')).toContainText('Nenhuma aula esperando avaliação');
  // Alunos: cadastra, edita e remove um aluno sem aula; a aluna com aula não tem "Remover"
  await acct.getByRole('navigation', { name: 'Minha conta' }).getByRole('link', { name: 'Alunos' }).click();
  await acct.waitForURL('**/conta/alunos');
  const addForm = acct.getByRole('region', { name: 'Cadastrar aluno' });
  await addForm.getByLabel('Primeiro nome').fill('Pedro');
  await addForm.getByLabel('Série').selectOption({ label: '1ª série do ensino médio' });
  await addForm.getByRole('button', { name: 'Cadastrar aluno' }).click();
  const pedro = acct.getByTestId('aluno-Pedro');
  await expect(pedro).toContainText('1ª série do ensino médio');
  await pedro.getByText('Editar').click();
  await pedro.getByLabel('Série').selectOption({ label: '2ª série do ensino médio' });
  await pedro.getByRole('button', { name: 'Salvar' }).click();
  await expect(pedro).toContainText('2ª série do ensino médio');
  await pedro.getByRole('button', { name: 'Remover' }).click();
  await expect(acct.getByTestId('aluno-Pedro')).toHaveCount(0);
  await expect(acct.getByTestId('aluno-Joana')).toContainText('Tem aulas na conta');
  await expect(acct.getByTestId('aluno-Joana').getByRole('button', { name: 'Remover' })).toHaveCount(0);
  await acct.goto(`/p/${SLUG}`);
  const reviews = acct.locator('#avaliacoes');
  await expect(reviews).toContainText('Maria L.');
  await expect(reviews).toContainText('[contato removido]');
  await expect(reviews).not.toContainText('Joana');
  // Meus dados: muda o nome (o "Olá" muda), desliga os avisos e troca o e-mail com o código; depois entra com o novo
  await acct.goto('/conta/dados');
  const myData = acct.getByRole('region', { name: 'Seus dados' });
  await myData.getByLabel('Seu nome').fill('Mariana Lima');
  await myData.getByLabel(/pelo WhatsApp/).uncheck();
  await myData.getByRole('button', { name: 'Salvar' }).click();
  await expect(myData.getByText('Dados salvos.')).toBeVisible();
  expect(await q(`SELECT name, whatsapp_opt_in_at FROM guardians WHERE email = 'maria.e2e@exemplo.com'`))
    .toEqual([{ name: 'Mariana Lima', whatsapp_opt_in_at: null }]);
  const emailBox = acct.getByRole('region', { name: 'E-mail' });
  await emailBox.getByLabel('E-mail novo').fill('mariana.e2e@exemplo.com');
  await emailBox.getByRole('button', { name: 'Enviar código' }).click();
  await emailBox.locator('#email-code').fill(await lastCode('mariana.e2e@exemplo.com'));
  await emailBox.getByRole('button', { name: 'Confirmar' }).click();
  await expect(emailBox.getByTestId('email-atual')).toHaveText('mariana.e2e@exemplo.com');
  await acct.getByRole('navigation', { name: 'Minha conta' }).getByRole('link', { name: 'Início' }).click();
  await expect(acct.getByRole('heading', { level: 1 })).toHaveText('Olá, Mariana');
  await acct.getByRole('button', { name: 'Sair' }).click();
  await acct.waitForURL('**/conta/entrar');
  await acct.fill('#email', 'mariana.e2e@exemplo.com');
  await acct.click('button:has-text("Receber código por e-mail")');
  await acct.waitForSelector('#code');
  await acct.fill('#code', await lastCode('mariana.e2e@exemplo.com'));
  await acct.click('button:has-text("Entrar")');
  await acct.waitForURL(/\/conta$/);
  // Mensagens: sem entrar, "Mandar mensagem" leva a Entrar com volta para a conversa
  const anonMsg = await (await browser.newContext()).newPage();
  await anonMsg.goto(`/p/${SLUG}`);
  await anonMsg.getByRole('link', { name: 'Mandar mensagem' }).click();
  await anonMsg.waitForURL(`**/conta/entrar?voltar=%2Fconta%2Fmensagens%2F${SLUG}`);
  await expect(anonMsg.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', `/conta/criar?voltar=%2Fconta%2Fmensagens%2F${SLUG}`);
  await anonMsg.close();
  // a responsável escreve com telefone: o contato fica oculto, e ela vê o motivo
  await acct.goto(`/p/${SLUG}`);
  await acct.getByRole('link', { name: 'Mandar mensagem' }).click();
  await acct.waitForURL(`**/conta/mensagens/${SLUG}`);
  await acct.getByLabel('Sua mensagem').fill('Oi, Ana! A Joana tem prova sexta. Meu zap é 11 98888-1111.');
  await acct.getByRole('button', { name: 'Enviar' }).click();
  const famThread = acct.getByTestId('conversa');
  await expect(famThread).toContainText('Meu zap é [contato oculto].');
  await expect(acct.getByText(/Ocultamos um contato/)).toBeVisible();
  // a professora vê 1 não lida no menu, abre a conversa e responde
  await teacher.goto('/professor');
  const teacherNav = teacher.getByRole('navigation', { name: 'Área do professor' });
  await expect(teacherNav.getByRole('link', { name: /Mensagens/ })).toContainText('1');
  await teacherNav.getByRole('link', { name: /Mensagens/ }).click();
  await teacher.waitForURL('**/professor/mensagens');
  await teacher.getByRole('link', { name: /Mariana L\./ }).click();
  await expect(teacher.getByTestId('conversa')).toContainText('[contato oculto]');
  await teacher.getByLabel('Sua mensagem').fill('Oi, Mariana! Vamos revisar frações.');
  await teacher.getByRole('button', { name: 'Enviar' }).click();
  await expect(teacher.getByTestId('conversa')).toContainText('Vamos revisar frações.');
  await expect(teacherNav.getByRole('link', { name: /Mensagens/ })).not.toContainText('1');
  // a responsável recebe um aviso por e-mail, sem o texto da mensagem, e vê a resposta
  await runSweeps(browser);
  const mails = await q(`SELECT subject, body FROM dev_outbox WHERE recipient = 'mariana.e2e@exemplo.com' AND subject LIKE 'Nova mensagem%'`);
  expect(mails.map((m) => m.subject)).toEqual(['Nova mensagem de Ana Souza na Reforce']);
  expect(mails[0]!.body).not.toContain('frações');
  await acct.reload();
  await expect(famThread).toContainText('Vamos revisar frações.');
  await acct.getByRole('navigation', { name: 'Minha conta' }).getByRole('link', { name: /Mensagens/ }).click();
  await acct.waitForURL('**/conta/mensagens');
  await expect(acct.getByRole('link', { name: /Ana Souza/ })).toContainText('Vamos revisar frações.');


  // 8. Fechada a janela de contestação (24 h), o repasse é liberado uma vez.
  await setClock(new Date(endsAt.getTime() + 24 * 60 * 60_000 + 60_000));
  await runSweeps(browser);
  expect(await q(`SELECT status FROM payouts WHERE booking_id = $1`, [booking!.id])).toEqual([{ status: 'released' }]);
  expect(await q(`SELECT count(*)::int AS n FROM dev_provider_calls WHERE operation = 'releaseEscrow'`)).toEqual([{ n: 1 }]);
  // em "Meus ganhos", o valor passa de "a receber" para "liberado"
  await teacher.goto('/professor/recebimento');
  await expect(teacher.getByTestId('ganho-a-receber')).toContainText('R$ 0,00');
  await expect(teacher.getByTestId('ganho-total')).toContainText('R$ 102,85');
  await expect(teacher.getByTestId(`repasse-${booking!.id}`)).toContainText('Liberado');
  // o painel interno mostra a situação em português
  await staff.goto('/interno/aulas');
  await expect(staff.getByRole('cell', { name: 'Liberado' })).toBeVisible();
  await expect(staff.getByText('released')).toHaveCount(0);
  await staff.goto('/interno');
  await expect(staff.getByText(/avisos de pagamento não processados/)).toBeVisible();

  // 8b. Uma família nova cria a conta sem comprar (sem aluno ainda) e depois reserva informando só o aluno
  const novaFam = await (await browser.newContext()).newPage();
  await novaFam.goto('/conta/entrar');
  await novaFam.getByRole('link', { name: 'Criar conta' }).click();
  await novaFam.waitForURL('**/conta/criar');
  await novaFam.getByLabel('Seu nome').fill('Carla Dias');
  await novaFam.getByLabel('E-mail').fill('carla.e2e@exemplo.com');
  await novaFam.getByLabel('WhatsApp', { exact: true }).fill('(11) 97777-2222');
  await novaFam.click('button:has-text("Criar conta")');
  await novaFam.waitForSelector('#code');
  await novaFam.fill('#code', await lastCode('carla.e2e@exemplo.com'));
  await novaFam.click('button:has-text("Confirmar e entrar")');
  await novaFam.waitForURL(/\/conta$/);
  await expect(novaFam.getByRole('heading', { level: 1 })).toHaveText('Olá, Carla');
  await novaFam.goto(`/p/${SLUG}`);
  await novaFam.locator('button[data-slot]').first().click();
  await novaFam.getByRole('link', { name: 'Reservar' }).click();
  await novaFam.waitForURL('**/reservar?**');
  await expect(novaFam.getByRole('heading', { name: 'Para quem é a aula?' })).toBeVisible();
  await expect(novaFam.getByRole('radio', { name: 'Novo aluno' })).toBeChecked();
  await novaFam.getByLabel('Primeiro nome do aluno').fill('Lucas');
  await novaFam.getByLabel('Série').selectOption({ label: '9º ano' });
  await novaFam.click('button:has-text("Reservar e ir para o pagamento")');
  await novaFam.waitForURL('**/pedido/**');
  expect(await q(
    `SELECT s.first_name FROM students s JOIN guardians g ON g.id = s.guardian_id WHERE g.email = 'carla.e2e@exemplo.com'`,
  )).toEqual([{ first_name: 'Lucas' }]);
  // ela abriu o perfil direto (o link do professor), sem passar pela busca: 5%
  expect(await q(
    `SELECT o.commission_bps FROM orders o JOIN guardians g ON g.id = o.guardian_id WHERE g.email = 'carla.e2e@exemplo.com'`,
  )).toEqual([{ commission_bps: 500 }]);

  // 9. Nenhum par de aulas ativas do mesmo professor se sobrepõe.
  expect(await q(
    `SELECT count(*)::int AS n FROM bookings a JOIN bookings b
        ON a.teacher_id = b.teacher_id AND a.id < b.id AND a.blocked && b.blocked
     WHERE a.status IN ('held','confirmed') AND b.status IN ('held','confirmed')`,
  )).toEqual([{ n: 0 }]);
});

test('código por e-mail: reenviar depois de 60 s e usar outro e-mail', async ({ page }) => {
  const email = 'reenvio.e2e@exemplo.com';
  const sent = async () => (await q(`SELECT count(*)::int AS n FROM dev_outbox WHERE recipient = $1`, [email]))[0]!.n as number;
  await page.clock.install(); // o relógio do navegador anda sozinho, e o teste pode adiantá-lo
  await page.goto('/professor/entrar');
  await expect(page.getByRole('link', { name: '← Voltar ao site' })).toHaveAttribute('href', '/');
  await page.fill('#email', email);
  await page.click('button:has-text("Receber código por e-mail")');
  await page.waitForSelector('#code');
  const resend = page.getByRole('button', { name: /Reenviar código/ });
  await expect(resend).toBeDisabled();
  await expect(resend).toHaveText(/Reenviar código em [01]:\d\d/);
  await expect(page.getByText('Não chegou? Confira também a caixa de spam.')).toBeVisible();

  // "Usar outro e-mail" volta ao primeiro passo, com o e-mail digitado
  await page.getByRole('button', { name: 'Usar outro e-mail' }).click();
  await expect(page.locator('#email')).toHaveValue(email);
  await page.click('button:has-text("Receber código por e-mail")');
  await page.waitForSelector('#code');

  // passado 1 minuto, o reenvio libera e manda um código novo, que entra
  const before = await sent();
  await page.clock.fastForward('01:01');
  await expect(resend).toBeEnabled();
  await expect(resend).toHaveText('Reenviar código');
  await resend.click();
  await expect.poll(sent).toBeGreaterThan(before);
  await expect(resend).toBeDisabled(); // a contagem recomeça
  await page.fill('#code', await lastCode(email));
  await page.click('button:has-text("Entrar")');
  await page.waitForURL('**/professor/boas-vindas');
});

test('topo do site no celular: uma linha, com menu; "Para professores" no rodapé', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect((await page.locator('header').first().boundingBox())!.height).toBeLessThanOrEqual(80);
  const nav = page.getByRole('navigation', { name: 'Principal' });
  await expect(nav.getByRole('link', { name: 'Entrar' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Seja professor' })).toBeHidden();
  await nav.getByText('Menu').click();
  await expect(nav.getByRole('link', { name: 'Buscar professor' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Seja professor' })).toBeVisible();
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Para professores' })).toHaveAttribute('href', '/professores');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  // ao escolher um link, o menu fecha na página seguinte
  await nav.getByRole('link', { name: 'Seja professor' }).click();
  await page.waitForURL('**/professores');
  await expect(nav.getByRole('link', { name: 'Seja professor' })).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const name of ['Buscar professor', 'Entrar', 'Seja professor']) await expect(nav.getByRole('link', { name })).toBeVisible();
});
