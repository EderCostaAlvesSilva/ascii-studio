import { describe, expect, it } from 'vitest';
import { areaResample, computeRows } from '../../src/core/resample';
import { makeImage, solid } from './helpers';

describe('computeRows', () => {
  it('aplica a correção de proporção de 0,5', () => {
    expect(computeRows(100, 100, 100)).toBe(50);
    expect(computeRows(200, 100, 100)).toBe(25);
  });

  it('limita a 400 linhas e ao mínimo de 1', () => {
    expect(computeRows(10, 1000, 200)).toBe(400);
    expect(computeRows(1000, 1, 30)).toBe(1);
  });
});

describe('areaResample', () => {
  it('calcula a média da área', () => {
    const img = makeImage(2, 2, (x) => (x === 0 ? [0, 0, 0, 255] : [100, 100, 100, 255]));
    const cells = areaResample(img, 1, 1);
    expect(cells[0]).toBeCloseTo(50);
    expect(cells[3]).toBeCloseTo(1);
  });

  it('pondera a cor pelo alfa, sem contaminar com pixels transparentes', () => {
    const img = makeImage(2, 1, (x) => (x === 0 ? [255, 0, 0, 255] : [0, 0, 255, 0]));
    const cells = areaResample(img, 1, 1);
    expect(cells[0]).toBeCloseTo(255);
    expect(cells[2]).toBeCloseTo(0);
    expect(cells[3]).toBeCloseTo(0.5);
  });

  it('considera frações de pixel ao reduzir', () => {
    const img = makeImage(3, 1, (x) => (x === 1 ? [90, 90, 90, 255] : [0, 0, 0, 255]));
    const cells = areaResample(img, 2, 1);
    expect(cells[0]).toBeCloseTo(30);
    expect(cells[4]).toBeCloseTo(30);
  });

  it('amplia imagens menores que a grade', () => {
    const cells = areaResample(solid(1, 1, 200), 3, 3);
    expect(cells).toHaveLength(36);
    for (let i = 0; i < 36; i += 4) expect(cells[i]).toBeCloseTo(200);
  });
});
