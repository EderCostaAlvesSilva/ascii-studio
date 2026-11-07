import { expect, test } from '@playwright/test';
import { artChanged, artText, goToGallery, saveAs, upload } from './helpers';

const trim = (page: import('@playwright/test').Page) => page.getByLabel('Remover contorno');

test('afina a borda de imagem transparente, é salvo e pode ser desfeito', async ({ page }) => {
  await upload(page, 'transparente.png');
  const original = await artText(page);
  const visible = (text: string) => text.replace(/\s/g, '').length;

  await trim(page).fill('40');
  const trimmed = await artChanged(page, original);
  expect(visible(trimmed)).toBeLessThan(visible(original));

  await saveAs(page, 'Sem contorno');
  await page.reload();
  await goToGallery(page);
  await page.getByRole('button', { name: 'Abrir Sem contorno' }).click();
  await expect.poll(() => artText(page)).toBe(trimmed);
  await expect(trim(page)).toHaveValue('40');

  await page.getByRole('button', { name: 'Restaurar padrões' }).click();
  await expect.poll(() => artText(page)).toBe(original);
});

test('não muda a arte de imagem sem transparência', async ({ page }) => {
  await upload(page, 'foto.jpg');
  const original = await artText(page);
  await trim(page).fill('40');
  await page.waitForTimeout(200);
  expect(await artText(page)).toBe(original);
});
