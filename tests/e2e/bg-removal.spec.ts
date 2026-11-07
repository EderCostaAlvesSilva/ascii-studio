import { expect, test } from '@playwright/test';
import { artChanged, artText, goToGallery, saveAs, upload } from './helpers';

const accept = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Baixar e remover' }).click();
const toggle = (page: import('@playwright/test').Page) => page.getByLabel('Remover fundo');

test('avisa antes, processa e deixa o fundo em branco; desativar volta sem reprocessar', async ({ page }) => {
  await upload(page);
  const base = await artText(page);

  await toggle(page).click();
  await expect(page.getByRole('dialog')).toContainText('54 MB');
  await expect(page.getByRole('dialog')).toContainText('não sai do dispositivo');
  await accept(page);

  await expect(toggle(page)).toBeChecked();
  const cut = await artChanged(page, base);
  const lines = cut.split('\n');
  expect(lines[0]!.trim()).toBe('');
  expect(lines[lines.length - 1]!.trim()).not.toBe('');

  // Fundo removido continua em branco com inversão.
  await page.getByLabel('Inverter claro e escuro').check();
  await expect.poll(async () => (await artText(page)).split('\n').at(-1)!.trim()).not.toBe(lines.at(-1)!.trim());
  expect((await artText(page)).split('\n')[0]!.trim()).toBe('');
  await page.getByLabel('Inverter claro e escuro').uncheck();

  await toggle(page).uncheck();
  await expect.poll(() => artText(page)).toBe(base);
  await toggle(page).check();
  await expect.poll(() => artText(page)).toBe(cut);
  expect(await page.evaluate(() => window.__BG_STUB_CALLS__)).toBe(1);
});

test('cancelar o aviso mantém a opção desativada', async ({ page }) => {
  await upload(page);
  await toggle(page).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(toggle(page)).not.toBeChecked();
  expect(await page.evaluate(() => window.__BG_STUB_CALLS__)).toBeUndefined();
});

test('falha informa, desativa a opção e mantém a arte', async ({ page }) => {
  await upload(page);
  const base = await artText(page);
  await page.evaluate(() => {
    window.__BG_STUB_FAIL__ = true;
  });
  await toggle(page).click();
  await accept(page);
  await expect(page.getByText('Não foi possível remover o fundo.')).toBeVisible();
  await expect(toggle(page)).not.toBeChecked();
  await expect(toggle(page)).toBeEnabled();
  expect(await artText(page)).toBe(base);
});

test('reabrir usa o resultado guardado, sem processar de novo', async ({ page }) => {
  await upload(page);
  const base = await artText(page);
  await toggle(page).click();
  await accept(page);
  const cut = await artChanged(page, base);
  await saveAs(page, 'Sem fundo');

  await page.reload();
  await goToGallery(page);
  await page.getByRole('button', { name: 'Abrir Sem fundo' }).click();
  await expect.poll(() => artText(page)).toBe(cut);
  await expect(toggle(page)).toBeChecked();
  expect(await page.evaluate(() => window.__BG_STUB_CALLS__)).toBeUndefined();
});

test('o aviso aparece só na primeira ativação', async ({ page }) => {
  await upload(page);
  await toggle(page).click();
  await accept(page);
  await expect(toggle(page)).toBeChecked();
  await upload(page);
  await toggle(page).click();
  await expect(toggle(page)).toBeChecked();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
