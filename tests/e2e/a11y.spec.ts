import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fixture, goToGallery, saveAs, upload } from './helpers';

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

test('sem violações WCAG A/AA nas telas principais', async ({ page }) => {
  await page.goto('/');
  await expectNoViolations(page);

  await upload(page);
  await page.getByText('Cartão estilo neofetch').click();
  await expect(page.getByTestId('cartao')).toBeVisible();
  await expectNoViolations(page);

  await page.getByRole('radio', { name: 'Claro' }).check();
  await page.getByLabel('Conjunto de caracteres').selectOption('custom');
  await page.getByLabel('Modo colorido').check();
  await expect(page.getByTestId('arte-canvas')).toBeVisible();
  await expectNoViolations(page);

  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoViolations(page);
  await page.getByRole('textbox', { name: 'Nome', exact: true }).fill('Acessível');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await goToGallery(page);
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(1);
  await expectNoViolations(page);

  await page.getByRole('button', { name: 'Excluir Acessível' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoViolations(page);
});

/** Avança com Tab até o elemento indicado ter o foco. */
async function tabTo(page: Page, locator: ReturnType<Page['locator']>, limit = 60) {
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab');
    if (await locator.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error('Não chegou ao elemento usando Tab');
}

test('fluxo principal só com teclado', async ({ page }) => {
  await page.goto('/');

  await tabTo(page, page.getByRole('button', { name: 'Escolher imagem' }));
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await (await chooser).setFiles(fixture('foto.png'));
  await expect(page.getByTestId('arte')).toBeVisible();

  await tabTo(page, page.getByLabel('Brilho'));
  await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Brilho')).toHaveValue('1');

  await tabTo(page, page.getByLabel('Inverter claro e escuro'));
  await page.keyboard.press('Space');
  await expect(page.getByLabel('Inverter claro e escuro')).toBeChecked();

  await tabTo(page, page.getByRole('button', { name: 'Salvar', exact: true }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Nome', exact: true })).toBeFocused();
  await page.keyboard.type('Pelo teclado');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('save-status')).toContainText('Pelo teclado');

  await tabTo(page, page.getByRole('button', { name: 'Galeria' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: 'Excluir Pelo teclado' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(1);
});

test('foco fica visível', async ({ page }) => {
  await upload(page);
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).toBe('solid');
});

test('a galeria funciona com o aviso de salvar, mantendo foco no diálogo', async ({ page }) => {
  await upload(page);
  await saveAs(page, 'Foco');
  await goToGallery(page);
  await page.getByRole('button', { name: 'Renomear Foco' }).click();
  await expect(page.getByRole('textbox', { name: 'Nome', exact: true })).toBeFocused();
});
