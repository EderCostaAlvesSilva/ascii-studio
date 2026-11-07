import { describe, expect, it } from 'vitest';
import { enhanceTones, luminance } from '../../src/core/adjust';
import { parseBackup, BACKUP_FORMAT } from '../../src/core/backup';
import { convert } from '../../src/core/convert';
import { nearestEmoji } from '../../src/core/emoji';
import { applyPreset, PRESETS } from '../../src/core/presets';
import { cropImage } from '../../src/core/resample';
import { DEFAULT_SETTINGS, normalizeSettings, widthLimits } from '../../src/core/types';
import { makeImage, settings, solid } from './helpers';

/** Grade RGBA em cinza, com alfa 1. */
const grayCells = (values: number[]) => new Float32Array(values.flatMap((v) => [v, v, v, 1]));
const toneAt = (cells: Float32Array, i: number) => luminance(cells[i * 4]!, cells[i * 4 + 1]!, cells[i * 4 + 2]!);

describe('enhanceTones', () => {
  it('espalha tons concentrados por toda a escala', () => {
    const narrow = Array.from({ length: 100 }, (_, i) => 100 + (i % 40));
    const out = enhanceTones(grayCells(narrow), 10, 10);
    const tones = narrow.map((_, i) => toneAt(out, i));
    expect(Math.max(...tones) - Math.min(...tones)).toBeGreaterThan(120);
  });

  it('realça detalhe escuro ao lado de uma região clara grande, como um rosto ao lado de uma camisa', () => {
    // 20 por 10: metade esquerda em meio-tom com uma "barba" um pouco mais escura; metade direita clara.
    const values = Array.from({ length: 200 }, (_, i) => {
      const x = i % 20;
      const y = Math.floor(i / 20);
      if (x >= 10) return 240;
      return x >= 4 && x < 6 && y >= 4 && y < 6 ? 110 : 130;
    });
    const out = enhanceTones(grayCells(values), 20, 10);
    const feature = 4 * 20 + 4;
    const around = 4 * 20 + 1;
    expect(toneAt(out, around) - toneAt(out, feature)).toBeGreaterThan(20 * 1.5);
  });

  it('preserva o matiz e a saturação', () => {
    const skin = [215, 150, 130];
    const cells = new Float32Array(Array.from({ length: 16 }, (_, i) => (i % 2 ? skin.map((v) => v * 0.6) : skin)).flatMap((c) => [...c, 1]));
    const out = enhanceTones(cells, 4, 4);
    let checked = 0;
    for (let o = 0; o < out.length; o += 4) {
      if (out[o]! === 0) continue; // Virou preto: não há matiz a comparar.
      expect(out[o + 1]! / out[o]!).toBeCloseTo(150 / 215, 3);
      expect(out[o + 2]! / out[o]!).toBeCloseTo(130 / 215, 3);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('não altera imagem de um tom só', () => {
    const cells = grayCells([120, 120, 120, 120]);
    expect(Array.from(enhanceTones(cells, 2, 2))).toEqual(Array.from(cells));
  });

  it('ignora áreas transparentes no cálculo e não mexe no alfa', () => {
    const withClear = new Float32Array([100, 100, 100, 1, 140, 140, 140, 1, 255, 255, 255, 0, 255, 255, 255, 0]);
    const without = new Float32Array([100, 100, 100, 1, 140, 140, 140, 1]);
    const out = enhanceTones(withClear, 2, 2);
    const same = enhanceTones(without, 2, 1);
    expect(out[0]).toBeCloseTo(same[0]!);
    expect(out[4]).toBeCloseTo(same[4]!);
    expect(out[11]).toBe(0);
    expect(out[8]).toBe(255);
  });

  it('não altera a entrada', () => {
    const input = grayCells([10, 200]);
    enhanceTones(input, 2, 1);
    expect(Array.from(input)).toEqual(Array.from(grayCells([10, 200])));
  });
});

describe('convert com contraste automático', () => {
  const lowContrast = makeImage(64, 64, (x) => {
    const v = 100 + Math.round((x / 63) * 40);
    return [v, v, v, 255];
  });

  it('usa mais caracteres da rampa numa imagem de pouco contraste', () => {
    const distinct = (auto: boolean) => new Set(convert(lowContrast, settings({ autoContrast: auto })).lines.join('')).size;
    expect(distinct(true)).toBeGreaterThan(distinct(false));
  });
});

describe('cropImage', () => {
  const image = makeImage(10, 10, (x, y) => [x, y, 0, 255]);

  it('recorta pela fração da imagem', () => {
    const out = cropImage(image, { x: 0.2, y: 0.5, width: 0.3, height: 0.2 });
    expect(out.width).toBe(3);
    expect(out.height).toBe(2);
    expect(Array.from(out.data.slice(0, 4))).toEqual([2, 5, 0, 255]);
  });

  it('nunca sai da imagem nem fica vazio', () => {
    const out = cropImage(image, { x: 0.95, y: 0.95, width: 0.5, height: 0.5 });
    expect(out.width).toBeGreaterThanOrEqual(1);
    expect(out.height).toBeGreaterThanOrEqual(1);
    expect(out.data.length).toBe(out.width * out.height * 4);
  });

  it('a conversão usa só a área recortada e recalcula a proporção', () => {
    const half = makeImage(100, 100, (x) => (x < 50 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    const off = { autoContrast: false, width: 30 };
    const art = convert(half, settings({ ...off, crop: { x: 0.5, y: 0, width: 0.5, height: 0.5 } }));
    expect(art.lines.join('')).toMatch(/^@+$/);
    expect(art.rows).toBe(15);
    const tall = convert(half, settings({ ...off, crop: { x: 0.5, y: 0, width: 0.25, height: 1 } }));
    expect(tall.rows).toBe(60);
  });
});

describe('emoji em rostos', () => {
  it.each([
    ['pele avermelhada', [215, 150, 130], '🟧'],
    ['pele em sombra', [150, 100, 80], '🟫'],
    ['barba', [60, 50, 45], '⬛'],
    ['olho escuro', [70, 45, 35], '⬛'],
  ] as Array<[string, [number, number, number], string]>)('%s', (_n, [r, g, b], esperado) => {
    expect(nearestEmoji(r, g, b)).toBe(esperado);
  });
});

describe('predefinições', () => {
  it('toda predefinição gera configurações válidas, a partir de qualquer conjunto', () => {
    expect(PRESETS.map((p) => p.id)).toEqual(['portrait', 'phone', 'readme']);
    for (const preset of PRESETS) {
      for (const rampId of ['simple', 'emoji'] as const) {
        const base = settings({ rampId, width: rampId === 'emoji' ? 14 : 100 });
        const next = { ...base, ...applyPreset(preset.id, base) };
        const { min, max } = widthLimits(next.rampId);
        expect(next.width).toBeGreaterThanOrEqual(min);
        expect(next.width).toBeLessThanOrEqual(max);
      }
    }
  });

  it('celular preserva o modo emoji, com largura que cabe na tela', () => {
    const patch = applyPreset('phone', settings({ rampId: 'emoji', width: 40 }));
    expect(patch.rampId).toBeUndefined();
    expect(patch.width).toBeLessThanOrEqual(16);
    expect(applyPreset('phone', settings()).width).toBeLessThanOrEqual(35);
  });

  it('não liga a remoção de fundo, que exige confirmação de download', () => {
    for (const preset of PRESETS) expect(applyPreset(preset.id, settings()).removeBackground).toBeUndefined();
  });
});

describe('compatibilidade com criações antigas', () => {
  const { autoContrast: _a, crop: _c, ...old } = DEFAULT_SETTINGS;

  it('normalizeSettings mantém o resultado antigo: sem contraste automático nem recorte', () => {
    expect(normalizeSettings(old as typeof DEFAULT_SETTINGS)).toMatchObject({ autoContrast: false, crop: null });
    expect(normalizeSettings({ ...DEFAULT_SETTINGS }).autoContrast).toBe(true);
  });

  const file = (s: object) =>
    JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: 1,
      creations: [{ id: 'a', name: 'A', art: 'x', settings: s, cardFields: [], createdAt: 1, updatedAt: 1, thumbnail: 'data:image/webp;base64,AAAA', working: 'data:image/png;base64,AAAA', cutout: null }],
    });

  it('backup antigo é aceito e normalizado', () => {
    const r = parseBackup(file(old));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.backup.creations[0]!.settings).toMatchObject({ autoContrast: false, crop: null });
  });

  it('valida o recorte do backup', () => {
    expect(parseBackup(file({ ...DEFAULT_SETTINGS, crop: { x: 0, y: 0, width: 0.5, height: 0.5 } })).ok).toBe(true);
    expect(parseBackup(file({ ...DEFAULT_SETTINGS, crop: { x: 0.9, y: 0, width: 0.5, height: 0.5 } })).ok).toBe(false);
    expect(parseBackup(file({ ...DEFAULT_SETTINGS, crop: { x: 0, y: 0, width: 0, height: 0.5 } })).ok).toBe(false);
    expect(parseBackup(file({ ...DEFAULT_SETTINGS, crop: 'tudo' })).ok).toBe(false);
    expect(parseBackup(file({ ...DEFAULT_SETTINGS, autoContrast: 'sim' })).ok).toBe(false);
  });
});

it('imagem sólida continua sólida com o padrão', () => {
  expect(convert(solid(8, 8, 255), settings({ width: 30 })).lines[0]![0]).toBe('@');
});
