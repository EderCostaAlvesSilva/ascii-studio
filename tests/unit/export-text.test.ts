import { describe, expect, it } from 'vitest';
import { toMarkdownBlock, toPlainText, toWhatsAppBlock } from '../../src/core/export-text';
import type { ArtResult } from '../../src/core/types';

const art = (lines: string[]): ArtResult => ({ cols: lines[0]!.length, rows: lines.length, lines, colors: null });

describe('toPlainText', () => {
  it('une as linhas com quebra, preservando espaços nas pontas', () => {
    expect(toPlainText(art([' a ', 'bcd']))).toBe(' a \nbcd');
  });
});

describe('toWhatsAppBlock', () => {
  it('corta as sobras em branco e usa o formato monoespaçado, sem desalinhar', () => {
    const result = toWhatsAppBlock(art(['      ', '  ab  ', '   c  ', '      ']));
    expect(result).toEqual({ text: '```ab\n c```', width: 2 });
  });

  it('mantém linhas em branco no meio da arte', () => {
    expect(toWhatsAppBlock(art(['a', ' ', 'b'])).text).toBe('```a\n\nb```');
  });

  it('arte toda em branco não gera bloco', () => {
    expect(toWhatsAppBlock(art(['   ', '   ']))).toEqual({ text: '', width: 0 });
  });
});

describe('toMarkdownBlock', () => {
  it('envolve em bloco de código', () => {
    expect(toMarkdownBlock(art(['ab', 'cd']))).toBe('```text\nab\ncd\n```');
  });

  it('usa cerca mais longa que qualquer sequência de crases da arte', () => {
    const md = toMarkdownBlock(art(['a````b']));
    expect(md.startsWith('`````text\n')).toBe(true);
    expect(md.endsWith('\n`````')).toBe(true);
  });
});
