import { expect, test, type Page } from '@playwright/test';
import { goToGallery, saveAs, upload } from './helpers';

const expectNoHorizontalScroll = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

test('sem rolagem horizontal da página em 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await expectNoHorizontalScroll(page);

  await upload(page);
  await page.getByLabel('Largura em caracteres, digitada').fill('200');
  await expect.poll(async () => (await page.getByTestId('arte').textContent())!.split('\n')[0]!.length).toBe(200);
  await expectNoHorizontalScroll(page);

  await page.getByText('Cartão estilo neofetch').click();
  await page.getByLabel('Valor de Nome').fill('x'.repeat(300));
  await expect(page.getByTestId('cartao')).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.getByLabel('Modo colorido').check();
  await expect(page.getByTestId('arte-canvas')).toBeVisible();
  await expectNoHorizontalScroll(page);

  await saveAs(page, 'n'.repeat(100));
  await goToGallery(page);
  await expect(page.getByRole('heading', { level: 3 })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test('a arte cabe na tela do celular na largura padrão', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await upload(page);
  const fits = await page.getByTestId('preview').evaluate((el) => el.scrollWidth <= el.clientWidth);
  expect(fits).toBe(true);
});
