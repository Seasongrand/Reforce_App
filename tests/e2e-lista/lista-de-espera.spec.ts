/**
 * Site em modo lista de espera, no navegador: a página de recrutamento de
 * professores (direção C), o formulário em duas etapas e o que fica aberto
 * ou fechado neste modo.
 */
import { expect, test } from '@playwright/test';

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
