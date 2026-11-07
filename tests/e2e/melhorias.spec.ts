import { expect, test, type Page } from '@playwright/test';
import { artChanged, artText, goToGallery, saveAs, upload } from './helpers';

const widthInput = (page: Page) => page.getByLabel('Largura em caracteres, digitada');

test.describe('copiar sem a API moderna (endereço de rede, sem HTTPS)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
      const state = window as unknown as { __copied?: string };
      document.execCommand = (command: string) => {
        if (command !== 'copy') return false;
        state.__copied = (document.activeElement as HTMLTextAreaElement).value;
        return true;
      };
    });
    await upload(page);
  });

  test('usa o método alternativo', async ({ page }) => {
    await page.getByRole('button', { name: 'Copiar texto' }).click();
    await expect(page.getByText('Texto copiado.')).toBeVisible();
    const copied = await page.evaluate(() => (window as unknown as { __copied?: string }).__copied);
    expect(copied).toBe(await artText(page));
  });

  test('devolve o foco ao botão e não deixa elemento sobrando', async ({ page, browserName }) => {
    const button = page.getByRole('button', { name: 'Copiar texto' });
    await button.focus();
    await button.click();
    // O Safari não foca botões ao clicar.
    if (browserName !== 'webkit') await expect(button).toBeFocused();
    await expect(page.locator('textarea')).toHaveCount(0);
  });
});

test('avisa ao fechar a aba só quando há trabalho não salvo', async ({ page }) => {
  await page.goto('/');
  const blocked = () =>
    page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
  expect(await blocked()).toBe(false);

  await page.getByTestId('file-input').setInputFiles('tests/fixtures/foto.png');
  await expect(page.getByTestId('arte')).toBeVisible();
  expect(await blocked()).toBe(true);

  await saveAs(page, 'Salva');
  expect(await blocked()).toBe(false);

  await page.getByLabel('Brilho').fill('10');
  await expect(page.getByTestId('save-status')).toContainText('não salva');
  expect(await blocked()).toBe(true);
});

test.describe('contraste automático', () => {
  test.beforeEach(({ page }) => upload(page));

  test('vem ligado e pode ser desligado', async ({ page }) => {
    const toggle = page.getByLabel('Contraste automático');
    await expect(toggle).toBeChecked();
    const on = await artText(page);
    await toggle.uncheck();
    await artChanged(page, on);
  });
});

test.describe('predefinições', () => {
  test.beforeEach(({ page }) => upload(page));

  test('aplicam vários ajustes com um clique', async ({ page }) => {
    await page.getByRole('button', { name: 'Celular' }).click();
    await expect(widthInput(page)).toHaveValue('32');
    await expect(page.getByLabel('Conjunto de caracteres')).toHaveValue('simple');
    await expect(page.getByLabel('Nitidez')).toHaveValue('50');

    await page.getByRole('button', { name: 'Retrato' }).click();
    await expect(widthInput(page)).toHaveValue('100');
    await expect(page.getByLabel('Conjunto de caracteres')).toHaveValue('detailed');

    await page.getByRole('button', { name: 'README' }).click();
    await expect(widthInput(page)).toHaveValue('60');
  });

  test('celular mantém o modo emoji', async ({ page }) => {
    await page.getByLabel('Conjunto de caracteres').selectOption('emoji');
    await widthInput(page).fill('40');
    await page.getByRole('button', { name: 'Celular' }).click();
    await expect(page.getByLabel('Conjunto de caracteres')).toHaveValue('emoji');
    await expect(widthInput(page)).toHaveValue('14');
  });
});

test.describe('recorte', () => {
  const lineCount = async (page: Page) => (await artText(page)).split('\n').length;
  const openCrop = async (page: Page) => {
    await page.getByRole('button', { name: /^Recortar imagem/ }).click();
    await expect(page.getByRole('dialog', { name: 'Recortar imagem' })).toBeVisible();
  };

  test.beforeEach(({ page }) => upload(page));

  test('por controles: muda a arte, é salvo e pode ser desfeito', async ({ page }) => {
    const whole = await artText(page);
    const rows = await lineCount(page);
    await openCrop(page);
    await page.getByRole('button', { name: 'Quadrado' }).click();
    await expect(page.getByLabel('Largura do recorte')).toHaveValue('75');
    await expect(page.getByLabel('Altura do recorte')).toHaveValue('100');
    await page.getByRole('button', { name: 'Aplicar recorte' }).click();
    await artChanged(page, whole);
    // Quadrado de 100 colunas tem 50 linhas; a imagem inteira, em 4:3, tem menos.
    await expect.poll(() => lineCount(page)).toBe(50);
    expect(rows).toBeLessThan(50);
    await expect(page.getByRole('button', { name: /Recortar imagem \(ativo\)/ })).toBeVisible();
    const cropped = await artText(page);

    await saveAs(page, 'Recortada');
    await page.reload();
    await goToGallery(page);
    await page.getByRole('button', { name: 'Abrir Recortada' }).click();
    await expect.poll(() => artText(page)).toBe(cropped);

    await openCrop(page);
    await page.getByRole('button', { name: 'Usar imagem inteira' }).click();
    await expect.poll(() => artText(page)).toBe(whole);
  });

  test('cancelar não altera nada; Esc também', async ({ page }) => {
    const whole = await artText(page);
    await openCrop(page);
    await page.getByLabel('Largura do recorte').fill('50');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
    await page.waitForTimeout(100);
    expect(await artText(page)).toBe(whole);

    await openCrop(page);
    await expect(page.getByLabel('Largura do recorte')).toHaveValue('100');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('por arraste: alça redimensiona e a caixa move, sem sair da imagem', async ({ page }) => {
    await openCrop(page);
    const handle = await page.getByTestId('crop-handle').boundingBox();
    const frame = (await page.getByTestId('crop-frame').boundingBox())!;
    await page.mouse.move(handle!.x + 5, handle!.y + 5);
    await page.mouse.down();
    await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2, { steps: 4 });
    await page.mouse.up();
    await expect(page.getByLabel('Largura do recorte')).not.toHaveValue('100');
    const width = await page.getByLabel('Largura do recorte').inputValue();
    expect(Number(width)).toBeGreaterThan(40);
    expect(Number(width)).toBeLessThan(60);

    const box = (await page.getByTestId('crop-box').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    // Bem além da borda da imagem, ainda dentro da janela.
    await page.mouse.move(frame.x + frame.width + 60, frame.y + frame.height + 20, { steps: 3 });
    await page.mouse.up();
    await expect(page.getByLabel('Largura do recorte')).toHaveValue(width);
    const left = Number(await page.getByLabel('Esquerda').inputValue());
    expect(left + Number(width)).toBeLessThanOrEqual(100);
    expect(left).toBeGreaterThan(40);
  });

  test('o tamanho vem antes da posição, que só pode mudar depois de reduzir', async ({ page }) => {
    await openCrop(page);
    const labels = await page.getByRole('dialog').getByRole('slider').evaluateAll((els) => els.map((el) => el.id));
    expect(labels).toEqual(['crop-width', 'crop-height', 'crop-x', 'crop-y']);
  });

  test('funciona só com teclado', async ({ page }) => {
    await openCrop(page);
    await page.getByLabel('Largura do recorte').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByLabel('Largura do recorte')).toHaveValue('99');
    await page.getByLabel('Esquerda').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByLabel('Esquerda')).toHaveValue('1');
  });
});
