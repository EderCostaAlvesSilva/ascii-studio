import { describe, expect, it } from 'vitest';
import { applyBrightness, applyContrast, contrastFactor, luminance, sharpen } from '../../src/core/adjust';

describe('brilho e contraste', () => {
  it('brilho soma proporcionalmente', () => {
    expect(applyBrightness(100, 0)).toBe(100);
    expect(applyBrightness(100, 50)).toBeCloseTo(227.5);
    expect(applyBrightness(100, -100)).toBeCloseTo(-155);
  });

  it('contraste zero é neutro', () => {
    expect(contrastFactor(0)).toBeCloseTo(1);
    expect(applyContrast(77, contrastFactor(0))).toBeCloseTo(77);
  });

  it('contraste positivo afasta do meio; negativo aproxima', () => {
    const up = contrastFactor(50);
    const down = contrastFactor(-50);
    expect(applyContrast(200, up)).toBeGreaterThan(200);
    expect(applyContrast(50, up)).toBeLessThan(50);
    expect(applyContrast(200, down)).toBeLessThan(200);
    expect(applyContrast(200, down)).toBeGreaterThan(128);
  });

  it('contraste máximo não diverge', () => {
    expect(Number.isFinite(contrastFactor(100))).toBe(true);
    expect(Number.isFinite(contrastFactor(-100))).toBe(true);
  });
});

describe('luminance', () => {
  it('segue os pesos Rec. 709', () => {
    expect(luminance(255, 255, 255)).toBeCloseTo(255);
    expect(luminance(0, 0, 0)).toBe(0);
    expect(luminance(0, 255, 0)).toBeGreaterThan(luminance(255, 0, 0));
    expect(luminance(255, 0, 0)).toBeGreaterThan(luminance(0, 0, 255));
  });
});

describe('sharpen', () => {
  const grid = () =>
    new Float32Array([
      100, 100, 100, 1, 100, 100, 100, 1, 100, 100, 100, 1, //
      100, 100, 100, 1, 200, 200, 200, 0.5, 100, 100, 100, 1, //
      100, 100, 100, 1, 100, 100, 100, 1, 100, 100, 100, 1,
    ]);

  it('quantidade zero mantém os valores', () => {
    expect(Array.from(sharpen(grid(), 3, 3, 0))).toEqual(Array.from(grid()));
  });

  it('aumenta a diferença entre vizinhos', () => {
    const out = sharpen(grid(), 3, 3, 50);
    expect(out[16]).toBeGreaterThan(200);
    expect(out[0]).toBeLessThanOrEqual(100);
  });

  it('não altera o alfa nem a entrada', () => {
    const input = grid();
    const out = sharpen(input, 3, 3, 100);
    expect(out[19]).toBeCloseTo(0.5);
    expect(Array.from(input)).toEqual(Array.from(grid()));
  });
});
