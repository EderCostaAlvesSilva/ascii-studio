// Gera as imagens de teste. Uso: node tests/fixtures/generate.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const dir = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage();

const render = (spec) =>
  page.evaluate(({ w, h, type, alpha, noise }) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    if (!alpha) {
      const g = x.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#102040');
      g.addColorStop(1, '#f0e0c0');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
    }
    x.fillStyle = '#e03030';
    x.beginPath();
    x.arc(w / 2, h / 2, Math.min(w, h) / 3, 0, Math.PI * 2);
    x.fill();
    if (noise) {
      for (let i = 0; i < 20000; i++) {
        x.fillStyle = `rgb(${(i * 37) % 255},${(i * 91) % 255},${(i * 13) % 255})`;
        x.fillRect((i * 7919) % w, (i * 104729) % h, 3, 3);
      }
    }
    return c.toDataURL(type, 0.9).split(',')[1];
  }, spec);

const save = async (name, spec) => writeFileSync(join(dir, name), Buffer.from(await render(spec), 'base64'));

await save('foto.png', { w: 400, h: 300, type: 'image/png' });
await save('foto.jpg', { w: 400, h: 300, type: 'image/jpeg' });
await save('foto.webp', { w: 400, h: 300, type: 'image/webp' });
await save('transparente.png', { w: 400, h: 300, type: 'image/png', alpha: true });
await save('referencia.png', { w: 1024, h: 768, type: 'image/png', noise: true });
writeFileSync(join(dir, 'animacao.gif'), Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));

await browser.close();
