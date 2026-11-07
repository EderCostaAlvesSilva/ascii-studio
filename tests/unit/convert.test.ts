import { describe, expect, it } from 'vitest';
import { convert } from '../../src/core/convert';
import { getRamp } from '../../src/core/ramps';
import { makeImage, settings, solid } from './helpers';

const gradient = makeImage(64, 64, (x, y) => {
  const v = Math.round(((x + y) / 126) * 255);
  return [v, 255 - v, v / 2, 255];
});

describe('convert', () => {
  it('é determinística', () => {
    const s = settings({ sharpness: 40, brightness: 10, color: true });
    const a = convert(gradient, s);
    const b = convert(gradient, s);
    expect(a.lines).toEqual(b.lines);
    expect(Array.from(a.colors!)).toEqual(Array.from(b.colors!));
  });

  it.each([30, 100, 200])('gera linhas com exatamente %i caracteres', (width) => {
    const art = convert(gradient, settings({ width }));
    expect(art.cols).toBe(width);
    expect(art.rows).toBe(Math.round(width * 0.5));
    expect(art.lines).toHaveLength(art.rows);
    for (const line of art.lines) expect(Array.from(line)).toHaveLength(width);
  });

  it.each(['simple', 'detailed', 'blocks'] as const)('só usa caracteres do conjunto %s', (rampId) => {
    const allowed = new Set(getRamp({ rampId, customRamp: '' }));
    const art = convert(gradient, settings({ rampId, width: 80 }));
    for (const ch of art.lines.join('')) expect(allowed.has(ch)).toBe(true);
  });

  it('no tema escuro, claro vira denso e preto vira espaço', () => {
    expect(convert(solid(8, 8, 255), settings({ width: 30 })).lines[0]![0]).toBe('@');
    expect(convert(solid(8, 8, 0), settings({ width: 30 })).lines[0]![0]).toBe(' ');
  });

  it('inverter troca claro e escuro', () => {
    expect(convert(solid(8, 8, 255), settings({ width: 30, invert: true })).lines[0]![0]).toBe(' ');
    expect(convert(solid(8, 8, 0), settings({ width: 30, invert: true })).lines[0]![0]).toBe('@');
  });

  it('trocar o tema equivale a trocar a inversão', () => {
    const light = convert(gradient, settings({ theme: 'light' }));
    const inverted = convert(gradient, settings({ invert: true }));
    expect(light.lines).toEqual(inverted.lines);
    const both = convert(gradient, settings({ theme: 'light', invert: true }));
    expect(both.lines).toEqual(convert(gradient, settings()).lines);
  });

  it('transparência vira espaço, mesmo com inversão ou tema claro', () => {
    const clear = solid(8, 8, 0, 0);
    for (const s of [settings({ width: 30 }), settings({ width: 30, invert: true }), settings({ width: 30, theme: 'light' })]) {
      expect(convert(clear, s).lines.join('').trim()).toBe('');
    }
  });

  it('brilho e contraste mudam o resultado', () => {
    const base = convert(gradient, settings()).lines;
    expect(convert(gradient, settings({ brightness: 50 })).lines).not.toEqual(base);
    expect(convert(gradient, settings({ contrast: 50 })).lines).not.toEqual(base);
    expect(convert(gradient, settings({ sharpness: 100 })).lines).not.toEqual(base);
  });

  it('brilho extremo satura sem sair da rampa', () => {
    expect(convert(gradient, settings({ brightness: 100, width: 30 })).lines.join('')).toMatch(/^@+$/);
  });

  it('cores só existem no modo colorido e têm RGB por célula', () => {
    expect(convert(gradient, settings()).colors).toBeNull();
    const art = convert(makeImage(4, 4, () => [255, 0, 0, 255]), settings({ width: 30, color: true }));
    expect(art.colors).toHaveLength(art.cols * art.rows * 3);
    expect(Array.from(art.colors!.slice(0, 3))).toEqual([255, 0, 0]);
  });

  it('um único caractere personalizado preenche tudo', () => {
    const art = convert(gradient, settings({ rampId: 'custom', customRamp: 'x', width: 30 }));
    expect(art.lines.join('')).toMatch(/^x+$/);
  });
});
