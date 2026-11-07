import { describe, expect, it } from 'vitest';
import { convert } from '../../src/core/convert';
import { EMOJI_PALETTE, emojiHex, nearestEmoji } from '../../src/core/emoji';
import { toWhatsAppBlock } from '../../src/core/export-text';
import { toSvg } from '../../src/core/export-svg';
import { toCardSvg } from '../../src/core/card';
import { parseBackup, BACKUP_FORMAT } from '../../src/core/backup';
import { DEFAULT_SETTINGS, widthLimits, type ArtResult } from '../../src/core/types';
import { makeImage, settings, solid } from './helpers';

const emoji = (patch = {}) => settings({ rampId: 'emoji', width: 14, ...patch });
const palette = new Set<string>(EMOJI_PALETTE.map((e) => e.char));

describe('nearestEmoji', () => {
  it.each([
    ['vermelho', [220, 30, 40], '🟥'],
    ['laranja', [240, 140, 20], '🟧'],
    ['amarelo', [250, 210, 60], '🟨'],
    ['verde', [40, 180, 60], '🟩'],
    ['azul puro', [0, 0, 255], '🟦'],
    ['azul claro', [90, 170, 240], '🟦'],
    ['roxo', [150, 60, 200], '🟪'],
    ['marrom', [120, 70, 40], '🟫'],
    ['pele clara', [224, 172, 105], '🟧'],
    ['preto', [10, 10, 10], '⬛'],
    ['branco', [250, 250, 250], '⬜'],
    ['cinza escuro', [90, 90, 90], '⬛'],
    ['cinza claro', [190, 190, 190], '⬜'],
    ['branco quente', [235, 225, 210], '⬜'],
    ['azul quase preto', [10, 10, 30], '⬛'],
  ] as Array<[string, [number, number, number], string]>)('%s', (_nome, [r, g, b], esperado) => {
    expect(nearestEmoji(r, g, b)).toBe(esperado);
  });

  it('todo emoji da paleta tem cor', () => {
    for (const { char } of EMOJI_PALETTE) expect(emojiHex(char)).toMatch(/^#[0-9a-f]{6}$/);
    expect(EMOJI_PALETTE).toHaveLength(9);
  });
});

describe('widthLimits', () => {
  it('emojis têm limite próprio', () => {
    expect(widthLimits('emoji')).toEqual({ min: 8, max: 60 });
    expect(widthLimits('simple')).toEqual({ min: 30, max: 200 });
  });
});

describe('convert com emojis', () => {
  const gradient = makeImage(64, 32, (x) => [x * 4, 255 - x * 4, 80, 255]);

  it('usa só emojis da paleta, com a largura pedida', () => {
    const art = convert(gradient, emoji());
    expect(art.emoji).toBe(true);
    expect(art.lines).toHaveLength(art.rows);
    for (const line of art.lines) {
      const cells = Array.from(line);
      expect(cells).toHaveLength(14);
      for (const cell of cells) expect(palette.has(cell)).toBe(true);
    }
  });

  it('não corrige proporção, porque o emoji é quadrado', () => {
    expect(convert(solid(100, 100, 255), emoji()).rows).toBe(14);
    expect(convert(solid(200, 100, 255), emoji()).rows).toBe(7);
  });

  it('segue a cor da imagem, sem mapa de cores à parte', () => {
    const art = convert(makeImage(4, 4, () => [220, 30, 40, 255]), emoji({ width: 8, color: true }));
    expect(art.lines[0]).toBe('🟥'.repeat(8));
    expect(art.colors).toBeNull();
  });

  it('ignora a inversão', () => {
    expect(convert(gradient, emoji({ invert: true })).lines).toEqual(convert(gradient, emoji()).lines);
  });

  it('brilho muda o resultado', () => {
    expect(convert(gradient, emoji({ brightness: 60 })).lines).not.toEqual(convert(gradient, emoji()).lines);
  });

  it('área transparente usa o quadrado do tema: um espaço desalinharia a linha', () => {
    const clear = solid(8, 8, 0, 0);
    expect(convert(clear, emoji({ width: 8 })).lines[0]).toBe('⬛'.repeat(8));
    expect(convert(clear, emoji({ width: 8, theme: 'light' })).lines[0]).toBe('⬜'.repeat(8));
  });

  it('as outras rampas não marcam a arte como emoji', () => {
    expect(convert(gradient, settings()).emoji).toBeFalsy();
  });
});

const art: ArtResult = { cols: 3, rows: 1, lines: ['🟥🟥⬜'], colors: null, emoji: true };

describe('exportação com emojis', () => {
  it('SVG desenha quadrados de 20 px na cor do emoji, unindo vizinhos, sem depender de fonte', () => {
    const svg = toSvg(art, 'dark');
    expect(svg).toContain('width="60"');
    expect(svg).toContain('height="20"');
    expect(svg).toContain(`<rect x="0" y="0" width="40" height="20" fill="${emojiHex('🟥')}"/>`);
    expect(svg).toContain(`<rect x="40" y="0" width="20" height="20" fill="${emojiHex('⬜')}"/>`);
    expect(svg).not.toContain('🟥');
    expect(svg).not.toContain('<text');
  });

  it('cartão reserva o espaço certo para a arte', () => {
    const svg = toCardSvg(art, [{ id: '1', label: 'Nome', value: 'Ana' }], 'dark');
    const infoX = Number(/<text x="(\d+)"[^>]*><tspan[^>]*>Nome:/.exec(svg)![1]);
    expect(infoX).toBe(24 + 60 + 40);
  });

  it('WhatsApp recebe os emojis sem crases: o formato monoespaçado não é necessário', () => {
    const { text, width } = toWhatsAppBlock({ lines: ['🟥⬜', '⬜🟥'], emoji: true });
    expect(text).toBe('🟥⬜\n⬜🟥');
    expect(width).toBe(2);
  });
});

describe('backup com emojis', () => {
  const file = (width: number) =>
    JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: 1,
      creations: [
        {
          id: 'a',
          name: 'A',
          art: '🟥',
          settings: { ...DEFAULT_SETTINGS, rampId: 'emoji', width },
          cardFields: [],
          createdAt: 1,
          updatedAt: 1,
          thumbnail: 'data:image/webp;base64,AAAA',
          working: 'data:image/png;base64,AAAA',
          cutout: null,
        },
      ],
    });

  it('aceita a largura de emojis e recusa a que passa do limite', () => {
    expect(parseBackup(file(14)).ok).toBe(true);
    expect(parseBackup(file(61)).ok).toBe(false);
    expect(parseBackup(file(7)).ok).toBe(false);
  });
});
