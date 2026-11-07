import { emojiHex } from '../../core/emoji';
import { canvasToBlob, context2d, createCanvas, type AnyContext2D } from './canvas';
import { BLOCK_ALPHA, CELL, EMOJI_CELL, FONT_STACK, THEME_COLORS, artPixelSize, type ArtResult, type Theme } from '../../core/types';

/** Desenha célula a célula em grade fixa, o que garante o alinhamento com qualquer fonte. */
export function drawArt(ctx: AnyContext2D, art: ArtResult, theme: Theme): void {
  const { bg, fg } = THEME_COLORS[theme];
  ctx.fillStyle = bg;
  const { width, height } = artPixelSize(art);
  ctx.fillRect(0, 0, width, height);

  if (art.emoji) {
    // Quadrados na cor da paleta: a fonte de emojis varia entre sistemas.
    art.lines.forEach((line, row) => {
      Array.from(line).forEach((cell, col) => {
        ctx.fillStyle = emojiHex(cell);
        ctx.fillRect(col * EMOJI_CELL, row * EMOJI_CELL, EMOJI_CELL, EMOJI_CELL);
      });
    });
    return;
  }

  ctx.font = `${CELL.fontSize}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  art.lines.forEach((line, row) => {
    Array.from(line).forEach((ch, col) => {
      if (ch === ' ') return;
      const x = col * CELL.width;
      const y = row * CELL.height;
      if (art.colors) {
        const i = (row * art.cols + col) * 3;
        ctx.fillStyle = `rgb(${art.colors[i]},${art.colors[i + 1]},${art.colors[i + 2]})`;
      } else {
        ctx.fillStyle = fg;
      }
      const blockAlpha = BLOCK_ALPHA[ch];
      if (blockAlpha) {
        ctx.globalAlpha = blockAlpha;
        ctx.fillRect(x, y, CELL.width, CELL.height);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillText(ch, x + CELL.width / 2, y + CELL.height / 2);
      }
    });
  });
}

export function renderPng(art: ArtResult, theme: Theme): Promise<Blob> {
  const { width, height } = artPixelSize(art);
  const canvas = createCanvas(width, height);
  drawArt(context2d(canvas), art, theme);
  return canvasToBlob(canvas, 'image/png');
}
