import { describe, expect, it } from 'vitest';
import { parseBackup, BACKUP_FORMAT } from '../../src/core/backup';
import { convert } from '../../src/core/convert';
import { erodeEdges, trimRadius } from '../../src/core/resample';
import { DEFAULT_SETTINGS, normalizeSettings } from '../../src/core/types';
import { makeImage, settings, solid } from './helpers';

const alphaAt = (image: { data: Uint8ClampedArray; width: number }, x: number, y: number) => image.data[(y * image.width + x) * 4 + 3];

/** Quadrado opaco de 10 a 29 em uma imagem de 40 por 40; o resto é transparente. */
const sticker = makeImage(40, 40, (x, y) => (x >= 10 && x < 30 && y >= 10 && y < 30 ? [200, 200, 200, 255] : [255, 255, 255, 0]));

describe('erodeEdges', () => {
  it('apaga a faixa da borda, com a espessura pedida, e mantém o interior', () => {
    const out = erodeEdges(sticker, 3);
    expect(alphaAt(out, 10, 20)).toBe(0);
    expect(alphaAt(out, 12, 20)).toBe(0);
    expect(alphaAt(out, 13, 20)).toBe(255);
    expect(alphaAt(out, 26, 20)).toBe(255);
    expect(alphaAt(out, 27, 20)).toBe(0);
    expect(alphaAt(out, 20, 12)).toBe(0);
    expect(alphaAt(out, 20, 13)).toBe(255);
  });

  it('preserva a cor do que continua visível', () => {
    const out = erodeEdges(sticker, 2);
    expect(out.data[(20 * 40 + 20) * 4]).toBe(200);
  });

  it('não corta na borda da imagem nem altera imagem sem transparência', () => {
    const opaque = solid(20, 20, 128);
    expect(Array.from(erodeEdges(opaque, 5).data)).toEqual(Array.from(opaque.data));
  });

  it('apaga semitransparentes junto à borda, como o contorno suavizado de figurinhas', () => {
    const soft = makeImage(20, 1, (x) => (x < 5 ? [0, 0, 0, 0] : x === 5 ? [255, 255, 255, 100] : [90, 90, 90, 255]));
    const out = erodeEdges(soft, 1);
    expect(alphaAt(out, 5, 0)).toBe(0);
    expect(alphaAt(out, 6, 0)).toBe(0);
    expect(alphaAt(out, 7, 0)).toBe(255);
  });

  it('não altera a entrada', () => {
    const before = Array.from(sticker.data);
    erodeEdges(sticker, 4);
    expect(Array.from(sticker.data)).toEqual(before);
  });
});

describe('trimRadius', () => {
  it('é proporcional ao maior lado da imagem, para valer em qualquer resolução', () => {
    expect(trimRadius(10, 1000, 500)).toBe(10);
    expect(trimRadius(10, 500, 1000)).toBe(10);
    expect(trimRadius(10, 512, 512)).toBe(5);
  });

  it('valor mínimo ainda tem efeito', () => {
    expect(trimRadius(1, 100, 100)).toBe(1);
  });
});

describe('convert com contorno removido', () => {
  // Contorno claro em volta de um miolo escuro, como a figurinha com boné preto.
  const outlined = makeImage(100, 100, (x, y) => {
    const dist = Math.max(Math.abs(x - 50), Math.abs(y - 50));
    if (dist > 40) return [0, 0, 0, 0];
    return dist > 34 ? [255, 255, 255, 255] : [20, 20, 20, 255];
  });
  const base = { width: 40, autoContrast: false };
  const dense = (text: string) => (text.match(/@/g) ?? []).length;

  it('some com o contorno claro, sem mudar o tamanho da arte', () => {
    const before = convert(outlined, settings(base));
    const after = convert(outlined, settings({ ...base, trimEdge: 60 }));
    expect(dense(before.lines.join(''))).toBeGreaterThan(0);
    expect(dense(after.lines.join(''))).toBe(0);
    expect(after.rows).toBe(before.rows);
  });

  it('zero mantém o resultado de antes', () => {
    expect(convert(outlined, settings(base)).lines).toEqual(convert(outlined, settings({ ...base, trimEdge: 0 })).lines);
  });

  it('funciona junto com o recorte', () => {
    const art = convert(outlined, settings({ ...base, trimEdge: 60, crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 } }));
    expect(dense(art.lines.join(''))).toBe(0);
  });
});

describe('compatibilidade', () => {
  const { trimEdge: _t, ...old } = DEFAULT_SETTINGS;
  const file = (s: object) =>
    JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: 1,
      creations: [{ id: 'a', name: 'A', art: 'x', settings: s, cardFields: [], createdAt: 1, updatedAt: 1, thumbnail: 'data:image/webp;base64,AAAA', working: 'data:image/png;base64,AAAA', cutout: null }],
    });

  it('criações antigas ficam sem remoção de contorno', () => {
    expect(normalizeSettings(old as typeof DEFAULT_SETTINGS).trimEdge).toBe(0);
  });

  it('backup valida o valor', () => {
    const parsed = parseBackup(file(old));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.backup.creations[0]!.settings.trimEdge).toBe(0);
    expect(parseBackup(file({ ...DEFAULT_SETTINGS, trimEdge: 12 })).ok).toBe(true);
    expect(parseBackup(file({ ...DEFAULT_SETTINGS, trimEdge: 999 })).ok).toBe(false);
    expect(parseBackup(file({ ...DEFAULT_SETTINGS, trimEdge: 'muito' })).ok).toBe(false);
  });
});
