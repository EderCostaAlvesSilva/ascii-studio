import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { download, downloadedText, goToGallery, saveAs, upload } from './helpers';

const readClipboard = (page: Page) => page.evaluate(async () => (await navigator.clipboard.readText()).replaceAll('\r\n', '\n'));
const widthInput = (page: Page) => page.getByLabel('Largura em caracteres, digitada');
const chooseEmoji = async (page: Page) => {
  await page.getByLabel('Conjunto de caracteres').selectOption('emoji');
  await expect(page.getByTestId('arte-canvas')).toBeVisible();
};
const copyWhatsApp = async (page: Page) => {
  await page.getByRole('button', { name: 'Copiar para WhatsApp' }).click();
  await expect(page.getByText('Copiado para o WhatsApp.').first()).toBeVisible();
  return readClipboard(page);
};

test.beforeEach(({ page }) => upload(page));

test('escolher emojis ajusta a largura, e voltar restaura o padrão', async ({ page }) => {
  await chooseEmoji(page);
  await expect(widthInput(page)).toHaveValue('14');
  await expect(page.getByLabel('Largura em caracteres', { exact: true })).toHaveAttribute('min', '8');
  await expect(page.getByLabel('Largura em caracteres', { exact: true })).toHaveAttribute('max', '60');

  await page.getByLabel('Conjunto de caracteres').selectOption('simple');
  await expect(widthInput(page)).toHaveValue('100');
  await expect(page.getByTestId('arte')).toBeVisible();
});

test('inverter e modo colorido ficam indisponíveis', async ({ page }) => {
  await chooseEmoji(page);
  await expect(page.getByLabel('Inverter claro e escuro')).toBeDisabled();
  await expect(page.getByLabel('Modo colorido')).toBeDisabled();
  await expect(page.getByText('Com emojis, a cor já vem de cada caractere.')).toBeVisible();
});

test('copiar leva os emojis, sem crases, e avisa quando deve quebrar no celular', async ({ page }) => {
  await chooseEmoji(page);
  const text = await copyWhatsApp(page);
  expect(text).not.toContain('`');
  const lines = text.split('\n');
  expect(lines.length).toBeGreaterThan(1);
  for (const line of lines) {
    expect(Array.from(line)).toHaveLength(14);
    expect(line).toMatch(/^[⬛⬜🟥🟧🟨🟩🟦🟪🟫]+$/u);
  }
  await expect(page.getByText('deve quebrar no celular')).toHaveCount(0);

  await widthInput(page).fill('30');
  await expect.poll(async () => Array.from((await copyWhatsApp(page)).split('\n')[0]!).length).toBe(30);
  await expect(page.getByText('deve quebrar no celular').first()).toBeVisible();
});

test('PNG e SVG usam a grade de 20 px', async ({ page }) => {
  await chooseEmoji(page);
  const svg = await downloadedText(await download(page, 'Baixar .svg'));
  expect(svg).toContain('width="280"');
  expect(svg).toContain('<rect');
  expect(svg).not.toContain('<text');

  const png = readFileSync(await (await download(page, 'Baixar .png')).path());
  const size = await page.evaluate(async (bytes) => {
    const blob = new Blob([Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0))], { type: 'image/png' });
    const bitmap = await createImageBitmap(blob);
    return [bitmap.width, bitmap.height];
  }, png.toString('base64'));
  expect(size[0]).toBe(280);
  expect(size[1]! % 20).toBe(0);
});

test('o cartão funciona com emojis', async ({ page }) => {
  await chooseEmoji(page);
  await page.getByText('Cartão estilo neofetch').click();
  await page.getByLabel('Valor de Nome').fill('Ana');
  await expect
    .poll(() => page.getByTestId('cartao').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true);
});

test('salva e reabre idêntica', async ({ page }) => {
  await chooseEmoji(page);
  await widthInput(page).fill('20');
  await expect.poll(async () => Array.from((await copyWhatsApp(page)).split('\n')[0]!).length).toBe(20);
  const art = await copyWhatsApp(page);
  await saveAs(page, 'Com emojis');

  await page.reload();
  await goToGallery(page);
  await page.getByRole('button', { name: 'Abrir Com emojis' }).click();
  await expect(page.getByTestId('arte-canvas')).toBeVisible();
  await expect(widthInput(page)).toHaveValue('20');
  await expect(page.getByLabel('Conjunto de caracteres')).toHaveValue('emoji');
  expect(await copyWhatsApp(page)).toBe(art);
});

test('fundo removido vira o quadrado do tema, sem desalinhar', async ({ page }) => {
  await chooseEmoji(page);
  await page.getByLabel('Remover fundo').click();
  await page.getByRole('button', { name: 'Baixar e remover' }).click();
  await expect(page.getByLabel('Remover fundo')).toBeChecked();
  await expect.poll(async () => (await copyWhatsApp(page)).split('\n')[0]).toBe('⬛'.repeat(14));

  await page.getByRole('radio', { name: 'Claro' }).check();
  await expect.poll(async () => (await copyWhatsApp(page)).split('\n')[0]).toBe('⬜'.repeat(14));
});

test('sem violações WCAG A/AA e sem rolagem horizontal em 360 px', async ({ page }) => {
  await chooseEmoji(page);
  await widthInput(page).fill('60');
  await page.setViewportSize({ width: 360, height: 740 });
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
