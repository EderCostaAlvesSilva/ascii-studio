import { expect, test } from '@playwright/test';
import { artChanged, artText, goToGallery, saveAs, upload } from './helpers';

test('salva, sobrevive a recarregar e reabre idêntica', async ({ page }) => {
  await upload(page);
  await page.getByLabel('Largura em caracteres, digitada').fill('77');
  await page.getByLabel('Brilho').fill('25');
  await page.getByLabel('Conjunto de caracteres').selectOption('detailed');
  await page.getByLabel('Inverter claro e escuro').check();
  await expect.poll(async () => (await artText(page)).split('\n')[0]!.length).toBe(77);
  await page.waitForTimeout(150);
  const art = await artText(page);
  await saveAs(page, 'Meu rosto');

  await page.reload();
  await goToGallery(page);
  const card = page.getByRole('listitem').filter({ hasText: 'Meu rosto' });
  await expect(card.getByRole('img')).toHaveCount(0); // miniatura é decorativa (alt vazio)
  await expect(card.locator('img')).toBeVisible();
  await page.getByRole('button', { name: 'Abrir Meu rosto' }).click();

  await expect.poll(() => artText(page)).toBe(art);
  await expect(page.getByLabel('Largura em caracteres, digitada')).toHaveValue('77');
  await expect(page.getByLabel('Brilho')).toHaveValue('25');
  await expect(page.getByLabel('Conjunto de caracteres')).toHaveValue('detailed');
  await expect(page.getByLabel('Inverter claro e escuro')).toBeChecked();
  await expect(page.getByTestId('save-status')).toContainText('Meu rosto');
});

test('recusa nome vazio', async ({ page }) => {
  await upload(page);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Informe um nome.');
});

test('Salvar atualiza a aberta; Salvar como nova preserva a original', async ({ page }) => {
  await upload(page);
  await saveAs(page, 'Original');
  const original = await artText(page);

  await page.getByLabel('Brilho').fill('50');
  const edited = await artChanged(page, original);
  await page.getByRole('button', { name: 'Salvar como nova' }).click();
  await page.getByRole('textbox', { name: 'Nome', exact: true }).fill('Variante');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByTestId('save-status')).toContainText('Variante');

  await goToGallery(page);
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(2);
  await page.getByRole('button', { name: 'Abrir Original' }).click();
  await expect.poll(() => artText(page)).toBe(original);

  await page.getByLabel('Brilho').fill('50');
  await expect.poll(() => artText(page)).toBe(edited);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('"Original" atualizada.')).toBeVisible();

  await goToGallery(page);
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(2);
  await page.getByRole('button', { name: 'Abrir Original' }).click();
  await expect(page.getByLabel('Brilho')).toHaveValue('50');
});

test('avisa antes de abrir outra criação com alterações não salvas', async ({ page }) => {
  await upload(page);
  await saveAs(page, 'A');
  await page.getByLabel('Brilho').fill('50');
  await goToGallery(page);
  await page.getByRole('button', { name: 'Abrir A' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('heading', { name: 'Galeria' })).toBeVisible();
  await page.getByRole('button', { name: 'Editor' }).click();
  await expect(page.getByLabel('Brilho')).toHaveValue('50');
});

test('busca, ordenação, renomear, duplicar e excluir', async ({ page }) => {
  await upload(page);
  await saveAs(page, 'Paisagem');
  await page.getByRole('button', { name: 'Salvar como nova' }).click();
  await page.getByRole('textbox', { name: 'Nome', exact: true }).fill('Coração');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByTestId('save-status')).toContainText('Coração');
  await goToGallery(page);

  const titles = page.getByRole('heading', { level: 3 });
  await expect(titles).toHaveText(['Coração', 'Paisagem']);
  await page.getByLabel('Ordenar por data').selectOption('oldest');
  await expect(titles).toHaveText(['Paisagem', 'Coração']);

  await page.getByLabel('Buscar por nome').fill('coracao');
  await expect(titles).toHaveText(['Coração']);
  await page.getByLabel('Buscar por nome').fill('zzz');
  await expect(page.getByText('Nenhuma criação com esse nome.')).toBeVisible();
  await page.getByLabel('Buscar por nome').fill('');

  await page.getByRole('button', { name: 'Renomear Paisagem' }).click();
  await page.getByRole('textbox', { name: 'Nome', exact: true }).fill('   ');
  await page.getByRole('dialog').getByRole('button', { name: 'Renomear' }).click();
  await expect(page.getByRole('alert')).toHaveText('Informe um nome.');
  await page.getByRole('textbox', { name: 'Nome', exact: true }).fill('Montanha');
  await page.getByRole('dialog').getByRole('button', { name: 'Renomear' }).click();
  await expect(page.getByRole('button', { name: 'Abrir Montanha' })).toBeVisible();

  await page.getByRole('button', { name: 'Duplicar Montanha' }).click();
  await expect(page.getByRole('button', { name: 'Abrir Montanha (cópia)' })).toBeVisible();
  await expect(titles).toHaveCount(3);

  await page.getByRole('button', { name: 'Excluir Montanha (cópia)' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(titles).toHaveCount(3);
  await page.getByRole('button', { name: 'Excluir Montanha (cópia)' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir' }).click();
  await expect(titles).toHaveCount(2);
});

test('excluir a criação aberta mantém o trabalho como rascunho', async ({ page }) => {
  await upload(page);
  await saveAs(page, 'Única');
  await goToGallery(page);
  await page.getByRole('button', { name: 'Excluir Única' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir' }).click();
  await expect(page.getByText('Sua galeria está vazia.')).toBeVisible();
  await page.getByRole('button', { name: 'Editor' }).click();
  await expect(page.getByTestId('save-status')).toContainText('Nova criação');
  await expect(page.getByTestId('arte')).toBeVisible();
});

test('galeria vazia orienta', async ({ page }) => {
  await page.goto('/');
  await goToGallery(page);
  await expect(page.getByText('Sua galeria está vazia.')).toBeVisible();
});
