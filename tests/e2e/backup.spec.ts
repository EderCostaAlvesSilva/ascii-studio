import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { artText, download, downloadedText, goToGallery, saveAs, upload } from './helpers';

test('exportar e importar em um navegador limpo restaura tudo', async ({ page, browser }) => {
  await upload(page);
  await page.getByLabel('Contraste', { exact: true }).fill('40');
  await page.waitForTimeout(150);
  const art = await artText(page);
  await saveAs(page, 'Backup A');
  await goToGallery(page);

  const file = await download(page, 'Exportar backup');
  expect(file.suggestedFilename()).toMatch(/^ascii-studio-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const backup = JSON.parse(await downloadedText(file));
  expect(backup.creations).toHaveLength(1);
  expect(backup.creations[0].working).toMatch(/^data:image\/png;base64,/);
  const path = await file.path();

  const clean = await browser.newContext();
  const other = await clean.newPage();
  await other.goto('/');
  await goToGallery(other);
  await expect(other.getByText('Sua galeria está vazia.')).toBeVisible();

  await other.getByTestId('import-input').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: readFileSync(path) });
  await expect(other.getByText('Adicionadas: 1. Cópias: 0. Ignoradas: 0.')).toBeVisible();
  await other.getByRole('button', { name: 'Abrir Backup A' }).click();
  await expect.poll(() => artText(other)).toBe(art);
  await expect(other.getByLabel('Contraste', { exact: true })).toHaveValue('40');

  await goToGallery(other);
  await other.getByTestId('import-input').setInputFiles(path);
  await expect(other.getByText('Adicionadas: 0. Cópias: 0. Ignoradas: 1.')).toBeVisible();
  await expect(other.getByRole('heading', { level: 3 })).toHaveCount(1);
  await clean.close();
});

test('arquivo inválido não altera a galeria', async ({ page }) => {
  await upload(page);
  await saveAs(page, 'Fica');
  await goToGallery(page);

  await page.getByTestId('import-input').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{nada') });
  await expect(page.getByText('não é um JSON válido')).toBeVisible();

  await page.getByTestId('import-input').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"outro"}') });
  await expect(page.getByText('não é um backup do ASCII Studio')).toBeVisible();
  await expect(page.getByRole('heading', { level: 3 })).toHaveText(['Fica']);
});
