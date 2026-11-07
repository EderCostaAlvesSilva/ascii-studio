import { expect, test } from '@playwright/test';
import { download, downloadedText, goToGallery, saveAs, upload } from './helpers';

test.beforeEach(async ({ page }) => {
  await upload(page);
  await page.getByText('Cartão estilo neofetch').click();
});

test('edita, adiciona e remove campos, e baixa o SVG', async ({ page }) => {
  await expect(page.getByLabel(/^Rótulo do campo/)).toHaveCount(5);
  await page.getByLabel('Valor de Nome').fill('Ana <Dev> & Cia');
  await page.getByLabel('Valor de Usuário').fill('ana_dev');

  await page.getByRole('button', { name: 'Adicionar campo' }).click();
  await page.getByLabel('Rótulo do campo 6').fill('Cidade');
  await page.getByLabel('Valor de Cidade').fill('Recife');
  await page.getByRole('button', { name: 'Remover Hobbies' }).click();
  await expect(page.getByRole('button', { name: 'Adicionar campo' })).toBeFocused();
  await expect(page.getByLabel(/^Rótulo do campo/)).toHaveCount(5);

  await expect(page.getByTestId('cartao')).toHaveAttribute('alt', /Cidade: Recife/);
  await expect
    .poll(() => page.getByTestId('cartao').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true);

  const svg = await downloadedText(await download(page, 'Baixar cartão .svg'));
  // O texto usa espaços não separáveis, que não colapsam ao exibir o SVG.
  expect(svg).toContain('Ana &lt;Dev&gt; &amp; Cia');
  expect(svg).toContain('>ana_dev<');
  expect(svg).toContain('Recife');
  expect(svg).not.toContain('Hobbies');
  const problems = await page.evaluate((text) => new DOMParser().parseFromString(text, 'image/svg+xml').querySelectorAll('parsererror').length, svg);
  expect(problems).toBe(0);
});

test('o cartão é salvo com a criação', async ({ page }) => {
  await page.getByLabel('Valor de Nome').fill('Ana');
  await saveAs(page, 'Com cartão');
  await page.reload();
  await goToGallery(page);
  await page.getByRole('button', { name: 'Abrir Com cartão' }).click();
  await page.getByText('Cartão estilo neofetch').click();
  await expect(page.getByLabel('Valor de Nome')).toHaveValue('Ana');
});
