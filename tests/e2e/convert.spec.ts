import { expect, test } from '@playwright/test';
import { artChanged, artText, dispatchFile, download, downloadedText, fixture, upload } from './helpers';

test.describe('envio', () => {
  test('seletor aceita JPG, PNG e WEBP', async ({ page }) => {
    await page.goto('/');
    for (const name of ['foto.jpg', 'foto.webp']) {
      await page.reload();
      await page.getByTestId('file-input').setInputFiles(fixture(name));
      await expect(page.getByTestId('arte')).toBeVisible();
    }
    await upload(page, 'foto.png');
  });

  test('arrastar e soltar', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'O evento de soltar sintético não carrega arquivos no WebKit.');
    await page.goto('/');
    await dispatchFile(page, 'drop', 'foto.png', 'image/png');
    await expect(page.getByTestId('arte')).toBeVisible();
  });

  test('colar imagem', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'O evento de colar sintético só carrega arquivos no Chromium.');
    await page.goto('/');
    await dispatchFile(page, 'paste', 'foto.png', 'image/png');
    await expect(page.getByTestId('arte')).toBeVisible();
  });

  test('colar algo que não é imagem é ignorado', async ({ page }) => {
    await upload(page);
    const before = await artText(page);
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', 'texto');
      document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await artText(page)).toBe(before);
  });

  test('recusa GIF e mantém o trabalho atual', async ({ page }) => {
    await upload(page);
    const before = await artText(page);
    await page.getByTestId('file-input').setInputFiles(fixture('animacao.gif'));
    await expect(page.getByText('Formato não aceito')).toBeVisible();
    expect(await artText(page)).toBe(before);
  });

  test('recusa arquivo acima de 25 MB', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('file-input').setInputFiles({
      name: 'grande.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(25 * 1024 * 1024 + 1),
    });
    await expect(page.getByText('limite de 25 MB')).toBeVisible();
  });

  test('explica quando o arquivo está corrompido', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('file-input').setInputFiles({ name: 'ruim.png', mimeType: 'image/png', buffer: Buffer.from('não é imagem') });
    await expect(page.getByText('corrompido')).toBeVisible();
  });

  test('avisa antes de substituir trabalho não salvo', async ({ page }) => {
    await upload(page);
    const before = await artText(page);
    await page.getByTestId('file-input').setInputFiles(fixture('foto.jpg'));
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
    expect(await artText(page)).toBe(before);

    await page.getByTestId('file-input').setInputFiles(fixture('foto.jpg'));
    await page.getByRole('dialog').getByRole('button', { name: 'Descartar' }).click();
    await artChanged(page, before);
  });
});

test.describe('ajustes', () => {
  test.beforeEach(({ page }) => upload(page));

  const lines = async (page: import('@playwright/test').Page) => (await artText(page)).split('\n');

  test('largura define os caracteres de cada linha, por controle e por digitação', async ({ page }) => {
    await page.getByLabel('Largura em caracteres', { exact: true }).fill('30');
    await expect.poll(async () => (await lines(page))[0]!.length).toBe(30);
    for (const line of await lines(page)) expect(line).toHaveLength(30);

    await page.getByLabel('Largura em caracteres, digitada').fill('200');
    await expect.poll(async () => (await lines(page))[0]!.length).toBe(200);

    // Valores fora do limite não são aplicados.
    await page.getByLabel('Largura em caracteres, digitada').fill('5');
    await page.getByLabel('Brilho').focus();
    await expect(page.getByLabel('Largura em caracteres, digitada')).toHaveValue('200');
  });

  test('conjuntos de caracteres', async ({ page }) => {
    await page.getByLabel('Conjunto de caracteres').selectOption('blocks');
    await expect(page.getByTestId('arte-canvas')).toBeVisible();
    expect(await downloadedText(await download(page, 'Baixar .txt'))).toMatch(/^[ ░▒▓█\n]+$/);
    await page.getByLabel('Conjunto de caracteres').selectOption('detailed');
    await expect.poll(async () => /[░▒▓█]/.test(await artText(page))).toBe(false);

    await page.getByLabel('Conjunto de caracteres').selectOption('custom');
    await page.getByLabel('Caracteres personalizados').fill('ab');
    await expect.poll(async () => /^[ab\n]+$/.test(await artText(page))).toBe(true);
    const before = await artText(page);

    await page.getByLabel('Caracteres personalizados').fill('a😀');
    await expect(page.getByText('quebraria o alinhamento')).toBeVisible();
    await page.getByLabel('Caracteres personalizados').fill('');
    await expect(page.getByText('pelo menos um caractere')).toBeVisible();
    expect(await artText(page)).toBe(before);
  });

  test('brilho, contraste, nitidez, inversão e restauração', async ({ page }) => {
    const base = await artText(page);
    for (const label of ['Brilho', 'Contraste', 'Nitidez']) {
      await page.getByLabel(label, { exact: true }).fill('60');
      await artChanged(page, base);
    }
    await page.getByRole('button', { name: 'Restaurar padrões' }).click();
    await expect.poll(() => artText(page)).toBe(base);

    await page.getByLabel('Inverter claro e escuro').check();
    await artChanged(page, base);
  });

  test('modo colorido e tema', async ({ page }) => {
    const base = await artText(page);
    await page.getByRole('radio', { name: 'Claro' }).check();
    await artChanged(page, base);
    await expect(page.getByTestId('preview')).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    await page.getByLabel('Modo colorido').check();
    await expect(page.getByTestId('arte-canvas')).toBeVisible();
    await expect(page.getByText('saem sem cor')).toBeVisible();
    await page.getByLabel('Modo colorido').uncheck();
    await expect(page.getByTestId('arte')).toBeVisible();
  });

  test('imagem transparente deixa o fundo em branco', async ({ page }) => {
    await page.getByTestId('file-input').setInputFiles(fixture('transparente.png'));
    await page.getByRole('dialog').getByRole('button', { name: 'Descartar' }).click();
    await expect.poll(async () => (await lines(page))[0]!.trim()).toBe('');
    await page.getByLabel('Inverter claro e escuro').check();
    await page.waitForTimeout(100);
    expect((await lines(page))[0]!.trim()).toBe('');
  });
});
