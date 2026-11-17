/**
 * Site em modo lista de espera, no navegador: a página de recrutamento de
 * professores (direção C), o formulário em duas etapas e o que fica aberto
 * ou fechado neste modo.
 */
import { expect, test } from '@playwright/test';
import { LISTA_BASE, LISTA_PASSWORD } from './env';

test('página da lista de espera: seções, perguntas e celular', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ensine. A cobrança é com a gente.');
  for (const h of [
    'Quatro passos até a primeira aula paga',
    'Você cuida da aula. O resto é automático.',
    'Perguntas frequentes',
    'Garanta seu lugar entre os primeiros',
  ]) {
    await expect(page.getByRole('heading', { name: h })).toBeVisible();
  }
  await expect(page.locator('details')).toHaveCount(8);
  await page.getByText('Preciso ter CNPJ?').click();
  await expect(page.getByText('Dá para receber como pessoa física')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await page.goto('/privacidade');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Política de privacidade da lista de espera');
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
  await page.getByLabel('Online').check();
  await page.getByLabel('Formação').selectOption('licenciatura');
  await page.getByLabel(/Autorizo o contato/).check();
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
