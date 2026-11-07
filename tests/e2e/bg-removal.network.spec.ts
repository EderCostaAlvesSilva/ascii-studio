import { expect, test } from '@playwright/test';
import { artText, fixture } from './helpers';

test('@network remove o fundo de verdade, em Worker, só com GETs ao CDN', async ({ page, context }) => {
  const external: Array<{ method: string; url: string }> = [];
  const local: string[] = [];
  context.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    if (url.hostname === 'localhost') local.push(url.pathname);
    else external.push({ method: request.method(), url: request.url() });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(fixture('foto.png'));
  await expect(page.getByTestId('arte')).toBeVisible();
  const before = await artText(page);

  // Nada da biblioteca é carregado antes da ativação.
  expect(external).toEqual([]);
  expect(local.filter((p) => /bg-removal|ort|dist-/.test(p))).toEqual([]);

  await page.getByLabel('Remover fundo').click();
  await page.getByRole('button', { name: 'Baixar e remover' }).click();

  await expect(page.getByLabel('Remover fundo')).toBeChecked({ timeout: 240_000 });
  await expect(async () => expect(await artText(page)).not.toBe(before)).toPass();

  expect(errors).toEqual([]);
  expect(external.length).toBeGreaterThan(0);
  for (const r of external) {
    expect(r.method).toBe('GET');
    expect(new URL(r.url).hostname).toBe('staticimgly.com');
  }

  // O gradiente do fundo sai; o canto da imagem fica em branco.
  const lines = (await artText(page)).split('\n');
  expect(lines[0]!.trim()).toBe('');
  expect(lines.join('').trim().length).toBeGreaterThan(0);
});
