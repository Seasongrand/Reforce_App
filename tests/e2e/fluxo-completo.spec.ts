/**
 * Fluxo completo da Fase 1 com os adaptadores falsos, web e worker reais:
 * professora se cadastra, é aprovada no painel e configura a agenda; uma
 * família abre o link, reserva, "paga" e recebe a confirmação; uma segunda
 * família não consegue o mesmo horário; a aula acontece na sala falsa, é
 * concluída e o repasse é liberado 24 h depois. Nenhuma reserva duplicada.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
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
  await teacher.waitForURL('**/professor/cadastro');
  // a área do professor tem o menu do painel, com a página atual marcada
  const nav = teacher.getByRole('navigation', { name: 'Área do professor' });
  for (const label of ['Início', 'Meu perfil', 'Serviços e preços', 'Agenda', 'Aulas', 'Documentos', 'Recebimento']) {
    await expect(nav.getByRole('link', { name: label })).toBeVisible();
  }
  await expect(nav.getByRole('link', { name: 'Meu perfil' })).toHaveAttribute('aria-current', 'page');
  await teacher.fill('#displayName', 'Ana Souza');
  await teacher.fill('#slug', SLUG);
  await teacher.fill('#headline', 'Matemática para o 9º ano');
  await teacher.check('input[aria-label="Matemática, 9º ano"]');
  await teacher.fill('#phone', '(11) 97777-6666');
  await teacher.check('input[name=whatsappOptIn]');
  await teacher.fill('#baseCep', '01310-100');
  await teacher.fill('#travelRadiusKm', '5');
  await teacher.fill('#teachingAddress', 'Rua das Flores, 100, Pinheiros');
  await teacher.click('button:has-text("Salvar perfil")');
  await expect(teacher.getByText('Perfil salvo.')).toBeVisible();
  const photoForm = teacher.getByTestId('foto');
  await photoForm.locator('input[type=file]').setInputFiles(path.join(FIXTURES, 'foto.jpg'));
  await photoForm.locator('button:has-text("Enviar foto")').click();
  await expect(photoForm.getByText('Em análise')).toBeVisible();

  await teacher.goto('/professor/verificacao');
  const docs: Array<[string, string[]]> = [
    ['identity', ['documento.pdf', 'selfie.pdf']], ['criminal_record', ['documento.pdf']], ['education', ['documento.pdf']],
  ];
  for (const [kind, files] of docs) {
    const section = teacher.locator(`[data-testid=verificacao-${kind}]`);
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

  // 3. A professora configura serviços e agenda.
  await teacher.goto('/professor/servicos');
  await teacher.fill('input[name=price]', '121,00');
  await teacher.click('button:has-text("Criar serviço")');
  await expect(teacher.getByText('Serviço criado.')).toBeVisible();
  await teacher.selectOption('select[name=modality]', 'at_student');
  await teacher.fill('input[name=price]', '150,00');
  await teacher.click('button:has-text("Criar serviço")');
  await expect(teacher.getByTestId('servicos')).toContainText('Na casa do aluno');
  await expect(teacher.getByTestId('servicos')).toContainText('intervalo 30/30 min');

  await teacher.goto('/professor/agenda');
  const ruleForm = teacher.locator('form:has(button:has-text("Adicionar horário"))');
  for (let day = 1; day <= 7; day++) {
    await ruleForm.locator('select[name=weekday]').selectOption(String(day));
    await ruleForm.locator('input[name=start]').fill('08:00');
    await ruleForm.locator('input[name=end]').fill('21:00');
    await ruleForm.locator('button:has-text("Adicionar horário")').click();
    await expect(teacher.getByTestId('regras').locator('li')).toHaveCount(day);
  }
  // aprovada, com serviço e agenda: os sete passos feitos e o link da página para divulgar
  await teacher.goto('/professor');
  await expect(teacher.getByTestId('progresso')).toHaveText('7 de 7');
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
  await fam1.waitForURL(`**/p/${SLUG}`);
  await expect(fam1.getByText('Perfil verificado')).toBeVisible();
  await expect(fam1.getByRole('img', { name: 'Foto de Ana Souza' })).toBeVisible();
  await fam1.getByRole('radio', { name: /online/i }).click();
  const slotButton = fam1.locator('button[data-slot]').first();
  const slotInstant = (await slotButton.getAttribute('data-slot'))!;
  await slotButton.click();
  const reserve = fam1.getByRole('link', { name: 'Reservar' });
  const slotUrl = new URL((await reserve.getAttribute('href'))!, fam1.url()).toString();
  expect(slotUrl).toContain(encodeURIComponent(slotInstant));

  await identifyAndReserve(fam1, slotUrl, { email: 'maria.e2e@exemplo.com', phone: '(11) 98888-1111' });
  await fam1.waitForURL('**/pedido/**');
  await expect(fam1.getByTestId('cronometro')).toContainText('guardado');
  await fam1.getByRole('button', { name: 'Pagar com PIX' }).click();
  await expect(fam1.getByTestId('pix').locator('img')).toBeVisible();
  await expect(fam1.getByRole('button', { name: 'Copiar código PIX' })).toBeVisible();
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

  await teacher.goto('/professor/aulas');
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
  )).toEqual([{ gross_cents: 12100, commission_bps: 500, platform_cents: 605, teacher_cents: 11495, status: 'held' }]);
  await teacher.goto('/professor/aulas');
  await expect(teacher.getByTestId(`aula-${booking!.id}`).getByTestId('situacao')).toHaveText('Concluída');

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
  await expect(acct.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Minha conta' })).toHaveAttribute('href', '/conta');
  const past = acct.getByTestId(`aula-${booking!.id}`);
  await past.getByRole('link', { name: 'Avaliar a aula' }).click();
  await acct.getByRole('radio', { name: /^5 —/ }).check({ force: true });
  await acct.fill('textarea[name=comment]', 'Explica com calma. Meu WhatsApp é 11 98888-1111');
  await acct.click('button:has-text("Enviar avaliação")');
  await acct.waitForURL('**/conta?avaliada=1');
  await expect(acct.getByText('Obrigado pela avaliação!')).toBeVisible();
  await expect(acct.getByTestId(`aula-${booking!.id}`)).toContainText('Sua avaliação');
  await acct.goto(`/p/${SLUG}`);
  const reviews = acct.locator('#avaliacoes');
  await expect(reviews).toContainText('Maria L.');
  await expect(reviews).toContainText('[contato removido]');
  await expect(reviews).not.toContainText('Joana');

  // 8. Fechada a janela de contestação (24 h), o repasse é liberado uma vez.
  await setClock(new Date(endsAt.getTime() + 24 * 60 * 60_000 + 60_000));
  await runSweeps(browser);
  expect(await q(`SELECT status FROM payouts WHERE booking_id = $1`, [booking!.id])).toEqual([{ status: 'released' }]);
  expect(await q(`SELECT count(*)::int AS n FROM dev_provider_calls WHERE operation = 'releaseEscrow'`)).toEqual([{ n: 1 }]);

  // 9. Nenhum par de aulas ativas do mesmo professor se sobrepõe.
  expect(await q(
    `SELECT count(*)::int AS n FROM bookings a JOIN bookings b
        ON a.teacher_id = b.teacher_id AND a.id < b.id AND a.blocked && b.blocked
     WHERE a.status IN ('held','confirmed') AND b.status IN ('held','confirmed')`,
  )).toEqual([{ n: 0 }]);
});
