import { expect, test } from '@playwright/test';
import { download, goToGallery, saveAs, upload } from './helpers';

test('nenhum fluxo envia dados nem acessa outra origem', async ({ page, context }) => {
  const requests: Array<{ method: string; url: string }> = [];
  context.on('request', (request) => {
    if (/^https?:/.test(request.url())) requests.push({ method: request.method(), url: request.url() });
  });

  await upload(page);
  await page.getByLabel('Brilho').fill('20');
  await page.getByLabel('Modo colorido').check();
  await page.getByLabel('Remover fundo').click();
  await page.getByRole('button', { name: 'Baixar e remover' }).click();
  await expect(page.getByLabel('Remover fundo')).toBeChecked();
  await download(page, 'Baixar .png');
  await download(page, 'Baixar .svg');
  await saveAs(page, 'Privada');
  await goToGallery(page);
  await download(page, 'Exportar backup');
  await page.getByRole('button', { name: 'Abrir Privada' }).click();
  await expect(page.getByTestId('arte-canvas')).toBeVisible();

  expect(requests.length).toBeGreaterThan(0);
  for (const { method, url } of requests) {
    expect(method, url).toBe('GET');
    expect(new URL(url).origin, url).toBe('http://127.0.0.1:4173');
  }
});
