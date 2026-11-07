import { describe, expect, it } from 'vitest';
import { getRamp, validateCustomRamp } from '../../src/core/ramps';

describe('getRamp', () => {
  it('fornece os conjuntos prontos, do menos para o mais denso', () => {
    expect(getRamp({ rampId: 'simple', customRamp: '' }).join('')).toBe(' .:-=+*#%@');
    expect(getRamp({ rampId: 'blocks', customRamp: '' }).join('')).toBe(' ░▒▓█');
    const detailed = getRamp({ rampId: 'detailed', customRamp: '' });
    expect(detailed).toHaveLength(70);
    expect(detailed[0]).toBe(' ');
    expect(detailed[69]).toBe('$');
  });

  it('usa o personalizado na ordem digitada, preservando repetidos', () => {
    expect(getRamp({ rampId: 'custom', customRamp: 'aab' })).toEqual(['a', 'a', 'b']);
  });

  it('conta caracteres por ponto de código', () => {
    expect(getRamp({ rampId: 'custom', customRamp: '𝐀b' })).toEqual(['𝐀', 'b']);
  });
});

describe('validateCustomRamp', () => {
  it('aceita um único caractere e repetidos', () => {
    expect(validateCustomRamp('#').ok).toBe(true);
    expect(validateCustomRamp('##..').ok).toBe(true);
  });

  it.each([
    ['vazio', ''],
    ['emoji', 'a😀'],
    ['largura dupla', 'a漢'],
    ['controle', 'a\tb'],
    ['quebra de linha', 'a\nb'],
    ['marca combinante', 'á'],
    ['largura zero', 'a‍b'],
    ['longo demais', 'x'.repeat(257)],
  ])('recusa %s com mensagem', (_nome, entrada) => {
    const r = validateCustomRamp(entrada);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });
});
