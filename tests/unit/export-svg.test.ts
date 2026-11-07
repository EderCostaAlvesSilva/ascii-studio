import { describe, expect, it } from 'vitest';
import { escapeXml, toSvg } from '../../src/core/export-svg';
import type { ArtResult } from '../../src/core/types';

const art = (lines: string[], colors: number[] | null = null): ArtResult => ({
  cols: lines[0]!.length,
  rows: lines.length,
  lines,
  colors: colors ? new Uint8ClampedArray(colors) : null,
});

describe('escapeXml', () => {
  it('escapa os caracteres especiais', () => {
    expect(escapeXml(`<a&"'>`)).toBe('&lt;a&amp;&quot;&apos;&gt;');
  });

  it('remove caracteres proibidos em XML', () => {
    expect(escapeXml('a\u0000b\u000bc\ud800d\ufffee\uffff')).toBe('abcde');
  });
});

describe('toSvg', () => {
  it('dimensiona pela grade de 10 por 20', () => {
    const svg = toSvg(art(['abc', 'def']), 'dark');
    expect(svg).toContain('width="30"');
    expect(svg).toContain('height="40"');
    expect(svg).toContain('viewBox="0 0 30 40"');
    expect(svg).toContain('textLength="30"');
  });

  it('troca espaços por espaços não separáveis, que não colapsam ao exibir o SVG como imagem', () => {
    const svg = toSvg(art(['  a b  ']), 'dark');
    expect(svg).toContain('>\u00a0\u00a0a\u00a0b\u00a0\u00a0</text>');
  });

  it('nunca põe espaço não separável dentro de uma tag', () => {
    expect(toSvg(art(['a b c'], [255, 0, 0, 0, 0, 0, 0, 255, 0, 0, 0, 0, 0, 0, 255]), 'dark')).not.toMatch(/<[^>]*\u00a0[^>]*>/);
  });

  it('preserva espaços e escapa o conteúdo', () => {
    const svg = toSvg(art(['<&>']), 'dark');
    expect(svg).toContain('&lt;&amp;&gt;');
    expect(svg).toContain('xml:space="preserve"');
    expect(svg).not.toContain('<&>');
  });

  it('usa o fundo do tema', () => {
    expect(toSvg(art(['a']), 'dark')).toContain('fill="#0d1117"');
    expect(toSvg(art(['a']), 'light')).toContain('fill="#ffffff"');
  });

  it('colore por trechos, juntando cores iguais', () => {
    const svg = toSvg(art(['aab'], [255, 0, 0, 255, 0, 0, 0, 0, 255]), 'dark');
    expect(svg).toContain('<tspan fill="#f00">aa</tspan>');
    expect(svg).toContain('<tspan fill="#00f">b</tspan>');
  });

  it('desenha blocos como retângulos, unindo vizinhos iguais', () => {
    const svg = toSvg(art(['██░ ']), 'dark');
    expect(svg).toContain('<rect x="0" y="0" width="20" height="20"/>');
    expect(svg).toContain('<rect x="20" y="0" width="10" height="20" opacity="0.25"/>');
    expect(svg).not.toContain('█');
    expect(svg).not.toContain('<text');
  });

  it('blocos coloridos usam a cor da célula; texto e blocos convivem na mesma linha', () => {
    const svg = toSvg(art(['█a'], [255, 0, 0, 0, 0, 255]), 'dark');
    expect(svg).toContain('width="10" height="20" fill="#f00"');
    expect(svg).toContain('<tspan fill="#00f">a</tspan>');
  });

  it('espaços continuam o trecho colorido anterior', () => {
    const svg = toSvg(art(['a b'], [255, 0, 0, 0, 0, 0, 255, 0, 0]), 'dark');
    expect(svg).toContain('<tspan fill="#f00">a\u00a0b</tspan>');
  });
});
