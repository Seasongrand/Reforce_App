/**
 * Site em modo lista de espera, no navegador: a página de recrutamento de
 * professores (visual da skill de design), o formulário em duas etapas e o que fica aberto
 * ou fechado neste modo.
 */
import { expect, test } from '@playwright/test';
import path from 'node:path';
import pg from 'pg';
import { LISTA_BASE, LISTA_DATABASE_URL, LISTA_PASSWORD } from './env';

test('página da lista de espera: seções, perguntas e celular', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Agenda e cobrança para professores');
  await expect(page.getByText('Agenda, cobrança e sala de aula para professores particulares.')).toBeAttached();
  for (const h of [
    'Da inscrição à primeira aula paga em 3 passos',
    'Cobrança, lembretes e sala de aula. Tudo dentro da Reforce.',
    'Perguntas dos professores',
    'Lista de espera dos primeiros professores',
  ]) {
    await expect(page.getByRole('heading', { name: h })).toBeAttached();
  }
  // as perguntas ficam todas abertas, sem acordeão
  await expect(page.locator('#perguntas details[open]')).toHaveCount(10);
  await expect(page.getByText('a Reforce fica com 15% das aulas de alunos que chegam pela busca')).toBeVisible();
  await expect(page.getByText('com o seu CPF (ou CNPJ, se tiver)')).toBeVisible();
  await expect(page.getByText('Se o aluno justificar, você pode devolver o valor pelo painel')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await page.goto('/privacidade');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Política de privacidade das listas de espera');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect((await request.get('/professor/entrar')).status()).toBe(404);
});

test('formulário em duas etapas: Enter avança, Voltar mantém, erro do servidor, convite e planilha', async ({ page, browser }) => {
  await page.goto('/#lista');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('informe seu nome completo')).toBeVisible();
  await page.getByLabel('Nome completo').fill('Bruna Lima');
  await page.getByLabel('E-mail', { exact: true }).fill('bruna.lista@exemplo.com');
  await page.getByLabel('WhatsApp (opcional)').fill('(21) 98888-7777');
  await page.getByLabel('Cidade', { exact: true }).fill('Rio de Janeiro');
  await page.getByLabel('UF').fill('rj');
  await page.getByLabel('UF').press('Enter');
  await expect(page.getByText('Etapa 2 de 2 · Suas aulas')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.getByLabel('Nome completo')).toHaveValue('Bruna Lima');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Ensino médio').check();
  await page.getByLabel('Online', { exact: true }).check();
  await expect(page.getByLabel('Inglês')).toBeVisible();
  await expect(page.getByLabel('Educação Física')).toBeVisible();
  await page.getByLabel('Formação', { exact: true }).selectOption('doutorado');
  await page.getByLabel(/Currículo/).setInputFiles(path.resolve('tests/e2e/fixtures/documento.pdf'));
  await page.getByLabel(/Autorizo o contato/).check();
  expect((await page.locator('input[name=consent]').boundingBox())!.width).toBeGreaterThanOrEqual(20); // caixa grande o bastante para o dedo
  await page.getByRole('button', { name: 'Entrar na lista de espera' }).click();
  await expect(page.locator('form').getByRole('alert')).toHaveText('escolha ao menos uma disciplina da lista');
  await expect(page.getByLabel('Ensino médio')).toBeChecked(); // o erro não apaga o que foi preenchido
  await page.getByLabel('Matemática').check();
  await page.getByRole('button', { name: 'Entrar na lista de espera' }).click();
  const ok = page.getByTestId('lista-ok');
  await expect(ok).toContainText('Inscrição recebida!');
  const invite = ok.getByRole('link', { name: 'Convidar pelo WhatsApp' });
  expect(decodeURIComponent((await invite.getAttribute('href'))!)).toContain('http://localhost:3201');
  const ctx = await browser.newContext({ httpCredentials: { username: 'equipe', password: LISTA_PASSWORD } });
  const csv = await (await ctx.request.get(`${LISTA_BASE}/api/lista-de-espera.csv`)).text();
  expect(csv).toContain('bruna.lista@exemplo.com');
  expect(csv).toContain('Doutorado');
  const cvUrl = /(http\S+\/api\/lista-de-espera\/curriculo\/[0-9a-f-]{36})/.exec(csv)?.[1];
  expect(cvUrl).toBeTruthy();
  const cv = await ctx.request.get(cvUrl!);
  expect(cv.status()).toBe(200);
  expect(cv.headers()['content-type']).toBe('application/pdf');
  expect((await page.request.get(cvUrl!)).status()).toBe(401);
  await ctx.close();
});

test('botão Entrar: o aluno pede aviso da abertura; planilha dos alunos com senha', async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  // no celular, "Entrar" fica na folha do menu, que o script do kit abre (data-ready: os scripts já rodaram)
  await page.locator('html[data-ready]').waitFor({ state: 'attached' });
  await page.getByRole('banner').getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('banner').getByRole('link', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A Reforce abre em breve para alunos');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByLabel('E-mail', { exact: true }).fill('paula.aviso@exemplo.com');
  await page.getByLabel('Cidade', { exact: true }).fill('Niterói');
  await page.getByLabel('UF').fill('rj');
  await page.getByLabel('Ensino médio').check();
  await page.getByLabel(/Tenho 18 anos/).check();
  expect((await page.locator('input[name=adult]').boundingBox())!.width).toBeGreaterThanOrEqual(20);
  await page.getByRole('button', { name: 'Quero ser avisado' }).click();
  await expect(page.locator('form').getByRole('alert')).toHaveText('escolha ao menos uma disciplina da lista');
  await expect(page.getByLabel('Cidade', { exact: true })).toHaveValue('Niterói'); // o erro não apaga o que foi preenchido
  await page.getByLabel('Inglês').check();
  await page.getByRole('button', { name: 'Quero ser avisado' }).click();
  const ok = page.getByTestId('aviso-ok');
  await expect(ok).toContainText('Pronto!');
  const invite = ok.getByRole('link', { name: 'Indicar a Reforce pelo WhatsApp' });
  expect(decodeURIComponent((await invite.getAttribute('href'))!)).toContain('http://localhost:3201/professores');
  const ctx = await browser.newContext({ httpCredentials: { username: 'equipe', password: LISTA_PASSWORD } });
  const csv = await (await ctx.request.get(`${LISTA_BASE}/api/lista-de-espera/alunos.csv`)).text();
  expect(csv).toContain('paula.aviso@exemplo.com,Niterói,RJ,Inglês,Ensino médio,');
  expect((await page.request.get('/api/lista-de-espera/alunos.csv')).status()).toBe(401);
  await ctx.close();
});

test('página da equipe: pede a senha, mostra o resumo, filtra e abre o currículo', async ({ page, browser }) => {
  expect((await page.request.get('/equipe')).status()).toBe(401);
  const db = new pg.Client({ connectionString: LISTA_DATABASE_URL });
  await db.connect();
  await db.query(`INSERT INTO teacher_waitlist (name, email, phone_e164, city, state, subject_ids, stages, modalities, education, consent_at)
                  VALUES ('Carla Equipe', 'carla.equipe@exemplo.com', '+5521966665555', 'Petrópolis', 'RJ', '{9}', '{medio}', '{online}',
                          'doutorado', now()) ON CONFLICT (email) DO NOTHING`);
  await db.query(`INSERT INTO teacher_waitlist_cvs (waitlist_id, file_name, content_type, bytes, uploaded_at)
                  SELECT id, 'cv.pdf', 'application/pdf', '\\x255044462d312e37'::bytea, now() FROM teacher_waitlist
                   WHERE email = 'carla.equipe@exemplo.com' ON CONFLICT (waitlist_id) DO NOTHING`);
  await db.query(`INSERT INTO student_waitlist (email, city, state, subject_ids, stages, consent_at)
                  VALUES ('responsavel.equipe@exemplo.com', 'Petropolis', 'RJ', '{9}', '{fund2}', now()) ON CONFLICT (email) DO NOTHING`);
  await db.end();

  const ctx = await browser.newContext({ httpCredentials: { username: 'equipe', password: LISTA_PASSWORD } });
  const team = await ctx.newPage();
  await team.setViewportSize({ width: 390, height: 844 });
  await team.goto('/equipe');
  await expect(team.getByRole('heading', { level: 1 })).toHaveText('Listas de espera');
  expect(await team.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  // "Petrópolis" e "Petropolis" contam como a mesma cidade: 1 professor e 1 aluno
  await expect(team.getByRole('row', { name: /Petrópolis\/RJ/ })).toHaveText(/Petrópolis\/RJ\s*1\s*1/);
  await team.getByLabel('Disciplina').selectOption({ label: 'História' });
  await team.getByRole('button', { name: 'Filtrar' }).click();
  await expect(team).toHaveURL(/disciplina=9/);
  const card = team.getByTestId('professor');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Carla Equipe');
  await expect(card).toContainText('Doutorado');
  await expect(card.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/5521966665555');
  const cv = await ctx.request.get((await card.getByRole('link', { name: 'Currículo' }).getAttribute('href'))!);
  expect(cv.status()).toBe(200);
  expect(cv.headers()['content-type']).toBe('application/pdf');
  await team.getByRole('link', { name: 'Alunos (1)' }).click();
  await expect(team.getByTestId('aluno')).toContainText('responsavel.equipe@exemplo.com');

  // excluir inscrição (de teste, ou a pedido da pessoa): confirma e some da lista e da planilha
  await team.getByTestId('aluno').getByText('Excluir inscrição').click();
  await team.getByTestId('aluno').getByRole('button', { name: 'Excluir de vez' }).click();
  await expect(team.getByRole('status')).toHaveText('Inscrição excluída.');
  await expect(team.getByText('responsavel.equipe@exemplo.com')).toHaveCount(0);
  await team.goto('/equipe?disciplina=9');
  await team.getByTestId('professor').getByText('Excluir inscrição').click();
  await team.getByTestId('professor').getByRole('button', { name: 'Excluir de vez' }).click();
  await expect(team.getByRole('status')).toHaveText('Inscrição excluída.');
  await expect(team.getByText('Carla Equipe')).toHaveCount(0);
  expect(await (await ctx.request.get(`${LISTA_BASE}/api/lista-de-espera.csv`)).text()).not.toContain('carla.equipe@exemplo.com');
  await ctx.close();
});

test('prévia do link e ícone abrem no modo lista de espera', async ({ page, request }) => {
  await page.goto('/');
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  const icon = await page.locator('link[rel="icon"]').first().getAttribute('href');
  expect(og).toBeTruthy();
  expect(icon).toBeTruthy();
  const ogRes = await request.get(new URL(og!).pathname + new URL(og!).search);
  expect(ogRes.status()).toBe(200);
  expect(ogRes.headers()['content-type']).toContain('image/png');
  const iconRes = await request.get(icon!);
  expect(iconRes.status()).toBe(200);
  expect(iconRes.headers()['content-type']).toContain('image/svg+xml');
});

test('a página dos professores também fica em /professores; a vitrine está fechada', async ({ page, request }) => {
  await page.goto('/professores');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Agenda e cobrança para professores');
  expect((await request.get('/buscar')).status()).toBe(404);
  expect((await request.get('/buscar?disciplina=1&serie=9')).status()).toBe(404);
  expect((await request.get('/conta')).status()).toBe(404);
  expect((await request.get('/conta/entrar')).status()).toBe(404);
});

test('acesso da equipe: com a senha, entra no painel interno e como professor e aluno de teste', async ({ page, browser }) => {
  const header = (password: string) => ({ authorization: `Basic ${Buffer.from(`equipe:${password}`).toString('base64')}` });
  for (const p of ['/professor', '/interno', '/conta']) {
    expect((await page.request.get(p)).status()).toBe(404);
    expect((await page.request.get(p, { headers: header('senha-errada-bem-longa') })).status()).toBe(404);
  }
  expect((await page.request.get('/professor/entrar', { headers: header(LISTA_PASSWORD) })).status()).toBe(200);

  const ctx = await browser.newContext({ httpCredentials: { username: 'equipe', password: LISTA_PASSWORD } });
  const team = await ctx.newPage();
  await team.setViewportSize({ width: 390, height: 844 });
  await team.goto('/equipe');
  const access = team.getByRole('region', { name: 'Acessos da equipe' });
  await expect(access).toContainText('contas de teste');
  expect(await team.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await access.getByRole('button', { name: 'Ver como professor' }).click();
  await expect(team).toHaveURL(/\/professor$/);
  await expect(team.getByRole('heading', { level: 1 })).toContainText('Olá, Professor');

  await team.goto('/equipe');
  await access.getByRole('button', { name: 'Ver como aluno' }).click();
  await expect(team).toHaveURL(/\/conta$/);
  await expect(team.getByRole('heading', { level: 1 })).toHaveText('Olá, Responsável');

  await team.goto('/equipe');
  await access.getByRole('button', { name: 'Painel interno' }).click();
  await expect(team).toHaveURL(/\/interno$/);
  await expect(team.getByRole('heading', { level: 1 })).toHaveText('Painel interno');

  // a sessão sozinha não abre nada: sem a senha, as áreas continuam fechadas
  const anon = await browser.newContext();
  await anon.addCookies(await ctx.cookies());
  expect((await anon.request.get('/professor')).status()).toBe(404);
  expect((await anon.request.get('/interno')).status()).toBe(404);
  await anon.close();
  await ctx.close();
});
