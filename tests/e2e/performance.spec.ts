import { expect, test } from '@playwright/test';
import { upload } from './helpers';

test.describe.configure({ mode: 'serial' });

test.beforeEach(({ page }) => upload(page, 'referencia.png'));

const setRange = `(el, value) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(value));
  el.dispatchEvent(new Event('input', { bubbles: true }));
}`;

test('com largura 120, um ajuste aparece em até 200 ms', async ({ page }) => {
  // Pior caso: a remoção de contorno percorre a imagem inteira a cada ajuste.
  await page.getByLabel('Remover contorno').fill('20');
  await page.getByLabel('Largura em caracteres, digitada').fill('120');
  await expect.poll(async () => (await page.getByTestId('arte').textContent())!.split('\n')[0]!.length).toBe(120);

  const times = await page.evaluate(async (setRangeSource) => {
    const set = (0, eval)(setRangeSource) as (el: Element, value: number) => void;
    const slider = document.getElementById('brightness')!;
    const art = document.querySelector('[data-testid="arte"]')!;
    const measured: number[] = [];
    for (let i = 1; i <= 9; i++) {
      await new Promise((r) => setTimeout(r, 30));
      measured.push(
        await new Promise<number>((resolve) => {
          const start = performance.now();
          const observer = new MutationObserver(() => {
            observer.disconnect();
            // O tempo inclui a pintura do quadro seguinte.
            requestAnimationFrame(() => resolve(performance.now() - start));
          });
          observer.observe(art, { childList: true, characterData: true, subtree: true });
          set(slider, i * 4 - 20); // Faixa em que a arte sempre muda: saturada, ela ficaria igual.
        }),
      );
    }
    return measured;
  }, setRange);

  const sorted = [...times].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  console.log(`Tempo de atualização (ms): mediana ${median.toFixed(1)}, máximo ${sorted.at(-1)!.toFixed(1)}`);
  expect(median).toBeLessThanOrEqual(200);
});

test('com largura máxima, a interface segue respondendo durante ajustes seguidos', async ({ page }) => {
  await page.getByLabel('Largura em caracteres, digitada').fill('200');
  await expect.poll(async () => (await page.getByTestId('arte').textContent())!.split('\n')[0]!.length).toBe(200);

  const longestStall = await page.evaluate(async (setRangeSource) => {
    const set = (0, eval)(setRangeSource) as (el: Element, value: number) => void;
    const slider = document.getElementById('contrast')!;
    let longest = 0;
    let last = performance.now();
    let running = true;
    const tick = () => {
      const now = performance.now();
      longest = Math.max(longest, now - last);
      last = now;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    for (let i = 0; i < 60; i++) {
      set(slider, (i % 100) - 50);
      await new Promise((r) => setTimeout(r, 16));
    }
    running = false;
    return longest;
  }, setRange);

  console.log(`Maior intervalo entre quadros (ms): ${longestStall.toFixed(1)}`);
  expect(longestStall).toBeLessThan(250);
});
