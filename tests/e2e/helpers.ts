import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Download, type Page } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));

export const fixture = (name: string) => join(here, '..', 'fixtures', name);

export async function upload(page: Page, name = 'foto.png') {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(fixture(name));
  await expect(page.getByTestId('arte')).toBeVisible();
}

export const artText = async (page: Page) => (await page.getByTestId('arte').textContent()) ?? '';

/** Espera a arte ficar diferente do texto indicado. */
export async function artChanged(page: Page, from: string) {
  await expect.poll(() => artText(page)).not.toBe(from);
  return artText(page);
}

/** Dispara no documento um evento de soltar ou colar, com o arquivo indicado. */
export async function dispatchFile(page: Page, kind: 'drop' | 'paste', name: string, type: string) {
  const base64 = readFileSync(fixture(name)).toString('base64');
  await page.evaluate(
    ({ kind, name, type, base64 }) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const data = new DataTransfer();
      data.items.add(new File([bytes], name, { type }));
      const event =
        kind === 'drop'
          ? new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true })
          : new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
    },
    { kind, name, type, base64 },
  );
}

export async function saveAs(page: Page, name: string) {
  // Medido: no build do WebKit para Windows, gravar Blob no IndexedDB falha; texto e ArrayBuffer funcionam.
  test.skip(page.context().browser()?.browserType().name() === 'webkit', 'WebKit para Windows não grava Blob no IndexedDB.');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nome', exact: true }).fill(name);
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByTestId('save-status')).toContainText('salva');
  await expect(page.getByTestId('save-status')).not.toContainText('não salva');
}

export const goToGallery = (page: Page) => page.getByRole('button', { name: 'Galeria' }).click();

export async function download(page: Page, button: string): Promise<Download> {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: button, exact: true }).click();
  return pending;
}

export const downloadedText = async (d: Download) => readFileSync(await d.path(), 'utf8');
