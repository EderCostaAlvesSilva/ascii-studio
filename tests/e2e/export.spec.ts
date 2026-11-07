import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { artText, download, downloadedText, upload } from './helpers';

const readClipboard = (page: import('@playwright/test').Page) => page.evaluate(async () => (await navigator.clipboard.readText()).replaceAll('\r\n', '\n')); // O Windows troca as quebras de linha.

/** Conta, no navegador, os pixels vermelhos de uma imagem. */
const redPixels = (page: import('@playwright/test').Page, bytes: string, type: string) =>
  page.evaluate(
    async ({ bytes, type }) => {
      const blob = new Blob([Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0))], { type });
      const image = new Image();
      image.src = URL.createObjectURL(blob);
      await image.decode();
      const canvas = new OffscreenCanvas(image.naturalWidth, image.naturalHeight);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let red = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i]! > 150 && data[i + 1]! < 90 && data[i + 2]! < 90) red++;
      return { red, width: canvas.width, height: canvas.height };
    },
    { bytes, type },
  );

test.beforeEach(({ page }) => upload(page));

test('copiar texto', async ({ page }) => {
  await page.getByRole('button', { name: 'Copiar texto' }).click();
  await expect(page.getByText('Texto copiado.')).toBeVisible();
  expect(await readClipboard(page)).toBe(await artText(page));
});

test('copiar Markdown', async ({ page }) => {
  await page.getByRole('button', { name: 'Copiar Markdown' }).click();
  await expect(page.getByText('Markdown copiado.')).toBeVisible();
  expect(await readClipboard(page)).toBe(`\`\`\`text\n${await artText(page)}\n\`\`\``);
});

test('copiar para WhatsApp usa o formato monoespaçado e avisa quando deve quebrar no celular', async ({ page }) => {
  await page.getByRole('button', { name: 'Copiar para WhatsApp' }).click();
  await expect(page.getByText('deve quebrar no celular')).toBeVisible();
  const copied = await readClipboard(page);
  expect(copied.startsWith('```')).toBe(true);
  expect(copied.endsWith('```')).toBe(true);

  await page.getByLabel('Largura em caracteres, digitada').fill('30');
  await expect.poll(async () => (await artText(page)).split('\n')[0]!.length).toBe(30);
  await page.getByRole('button', { name: 'Copiar para WhatsApp' }).click();
  await expect.poll(() => readClipboard(page)).not.toBe(copied);
  for (const line of (await readClipboard(page)).replaceAll('```', '').split('\n')) {
    expect(line.length).toBeLessThanOrEqual(30);
  }
});

test('explica o que fazer quando a arte perde a forma ao colar', async ({ page }) => {
  await page.getByText('A arte perdeu a forma ao colar?').click();
  await expect(page.getByText('Quebra automática de linha')).toBeVisible();
});

test('falha de permissão sugere baixar', async ({ page }) => {
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error('negado'));
    document.execCommand = () => false;
  });
  await page.getByRole('button', { name: 'Copiar texto' }).click();
  await expect(page.getByText('baixe o arquivo')).toBeVisible();
});

test('baixar .txt', async ({ page }) => {
  const file = await download(page, 'Baixar .txt');
  expect(file.suggestedFilename()).toBe('ascii-art.txt');
  expect(await downloadedText(file)).toBe(await artText(page));
});

test('baixar .svg gera XML válido', async ({ page }) => {
  const file = await download(page, 'Baixar .svg');
  expect(file.suggestedFilename()).toBe('ascii-art.svg');
  const svg = await downloadedText(file);
  const problems = await page.evaluate((text) => new DOMParser().parseFromString(text, 'image/svg+xml').querySelectorAll('parsererror').length, svg);
  expect(problems).toBe(0);
  expect(svg).toContain('<svg');
});

test('o SVG mantém o recuo da arte quando exibido como imagem', async ({ page }) => {
  // Fundo transparente: as linhas começam com espaços.
  await page.getByTestId('file-input').setInputFiles('tests/fixtures/transparente.png');
  await page.getByRole('dialog').getByRole('button', { name: 'Descartar' }).click();
  await page.getByLabel('Conjunto de caracteres').selectOption('simple');
  await page.getByLabel('Contraste automático').uncheck();
  await page.waitForTimeout(200);
  const lines = (await artText(page)).split('\n');
  const svg = await downloadedText(await download(page, 'Baixar .svg'));
  const row = lines.findIndex((line) => /^ {6,}\S/.test(line));
  expect(row).toBeGreaterThanOrEqual(0);
  const indent = lines[row]!.length - lines[row]!.trimStart().length;

  const firstInk = await page.evaluate(
    async ({ svg, row }) => {
      const image = new Image();
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      const { data } = ctx.getImageData(0, row * 20, canvas.width, 20);
      for (let x = 0; x < canvas.width; x++) {
        for (let y = 0; y < 20; y++) {
          const i = (y * canvas.width + x) * 4;
          if (data[i]! > 100) return x;
        }
      }
      return -1;
    },
    { svg, row },
  );
  // Sem o conserto, os espaços colapsavam e a letra aparecia colada à esquerda.
  expect(firstInk).toBeGreaterThanOrEqual(indent * 10 - 2);
  expect(firstInk).toBeLessThan((indent + 1) * 10 + 2);
});

test('baixar .png na grade de 10 por 20', async ({ page }) => {
  const file = await download(page, 'Baixar .png');
  const bytes = readFileSync(await file.path());
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  const info = await redPixels(page, bytes.toString('base64'), 'image/png');
  const lines = (await artText(page)).split('\n');
  expect(info.width).toBe(lines[0]!.length * 10);
  expect(info.height).toBe(lines.length * 20);
  expect(info.red).toBe(0);
});

test('modo colorido preserva as cores em PNG e SVG e avisa nos formatos de texto', async ({ page }) => {
  await page.getByLabel('Modo colorido').check();
  await expect(page.getByTestId('arte-canvas')).toBeVisible();
  await expect(page.getByText('Texto, Markdown, WhatsApp e .txt saem sem cor')).toBeVisible();

  const png = readFileSync(await (await download(page, 'Baixar .png')).path());
  expect((await redPixels(page, png.toString('base64'), 'image/png')).red).toBeGreaterThan(100);

  const svg = await downloadedText(await download(page, 'Baixar .svg'));
  expect(svg).toContain('<tspan fill="#');

  const txt = await downloadedText(await download(page, 'Baixar .txt'));
  expect(txt).not.toContain('#e');
  expect(txt).not.toContain('<');
});
