import { emojiHex } from './emoji';
import { BLOCK_ALPHA, CELL, EMOJI_CELL, FONT_STACK, THEME_COLORS, artPixelSize, type ArtResult, type Theme } from './types';

const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

export function escapeXml(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '')
    .replace(/[&<>"']/g, (ch) => XML_ESCAPES[ch]!);
}

/**
 * Espaço comum colapsa quando o SVG é exibido como imagem (xml:space é ignorado),
 * e o textLength esticaria o que sobrou. O espaço não separável nunca colapsa.
 */
const NBSP = '\u00a0';
export const keepSpaces = (text: string) => text.replace(/ /g, NBSP);

/** Reduz cada canal a 4 bits: no tamanho de um caractere não se nota, e o arquivo fica bem menor. */
function shortHex(r: number, g: number, b: number): string {
  const digit = (v: number) => Math.round(v / 17).toString(16);
  return `#${digit(r)}${digit(g)}${digit(b)}`;
}

function coloredLine(chars: string[], colors: Uint8ClampedArray, row: number, cols: number): string {
  let out = '';
  let run = '';
  let runColor: string | null = null;
  const flush = () => {
    if (!run) return;
    out += runColor ? `<tspan fill="${runColor}">${keepSpaces(escapeXml(run))}</tspan>` : keepSpaces(escapeXml(run));
    run = '';
  };
  chars.forEach((ch, x) => {
    if (ch !== ' ') {
      const i = (row * cols + x) * 3;
      const color = shortHex(colors[i]!, colors[i + 1]!, colors[i + 2]!);
      if (color !== runColor) {
        flush();
        runColor = color;
      }
    }
    run += ch;
  });
  flush();
  return out;
}

/** Blocos viram retângulos, unindo vizinhos iguais: como texto, a fonte deixaria frestas. */
function blockRects(chars: string[], colors: Uint8ClampedArray | null, row: number, cols: number, x0: number, y0: number): string {
  let out = '';
  let start = 0;
  let current = '';
  const flush = (end: number) => {
    if (!current) return;
    const [ch, fill] = current.split('|') as [string, string];
    const fillAttr = fill ? ` fill="${fill}"` : '';
    const opacity = BLOCK_ALPHA[ch]! < 1 ? ` opacity="${BLOCK_ALPHA[ch]}"` : '';
    const x = x0 + start * CELL.width;
    const y = y0 + row * CELL.height;
    out += `<rect x="${x}" y="${y}" width="${(end - start) * CELL.width}" height="${CELL.height}"${fillAttr}${opacity}/>`;
  };
  chars.forEach((ch, x) => {
    let key = '';
    if (BLOCK_ALPHA[ch] !== undefined) {
      const i = (row * cols + x) * 3;
      key = `${ch}|${colors ? shortHex(colors[i]!, colors[i + 1]!, colors[i + 2]!) : ''}`;
    }
    if (key !== current) {
      flush(x);
      current = key;
      start = x;
    }
  });
  flush(chars.length);
  return out;
}

/** Emojis viram quadrados na cor da paleta, unindo vizinhos: a fonte de emojis varia entre sistemas. */
function emojiRects(art: ArtResult, x0: number, y0: number): string {
  let out = '';
  art.lines.forEach((line, row) => {
    const cells = Array.from(line);
    let start = 0;
    cells.forEach((cell, x) => {
      if (cells[x + 1] === cell) return;
      out += `<rect x="${x0 + start * EMOJI_CELL}" y="${y0 + row * EMOJI_CELL}" width="${(x + 1 - start) * EMOJI_CELL}" height="${EMOJI_CELL}" fill="${emojiHex(cell)}"/>`;
      start = x + 1;
    });
  });
  return `<g shape-rendering="crispEdges">${out}</g>`;
}

/** Linhas da arte como elementos SVG, a partir da posição indicada. */
export function artToSvgText(art: ArtResult, originX: number, originY: number): string {
  if (art.emoji) return emojiRects(art, originX, originY);
  const textLength = art.cols * CELL.width;
  let rects = '';
  let texts = '';
  art.lines.forEach((line, row) => {
    const chars = Array.from(line);
    rects += blockRects(chars, art.colors, row, art.cols, originX, originY);
    const textChars = chars.map((ch) => (BLOCK_ALPHA[ch] === undefined ? ch : ' '));
    if (textChars.every((ch) => ch === ' ')) return;
    const y = originY + row * CELL.height + CELL.height * 0.75;
    const content = art.colors ? coloredLine(textChars, art.colors, row, art.cols) : keepSpaces(escapeXml(textChars.join('')));
    texts += `<text x="${originX}" y="${y}" textLength="${textLength}" lengthAdjust="spacing">${content}</text>`;
  });
  return (rects ? `<g shape-rendering="crispEdges">${rects}</g>` : '') + texts;
}

export function svgDocument(width: number, height: number, theme: Theme, body: string): string {
  const colors = THEME_COLORS[theme];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="100%" height="100%" fill="${colors.bg}"/>` +
    `<g xml:space="preserve" style="white-space:pre" font-family="${escapeXml(FONT_STACK)}" font-size="${CELL.fontSize}" fill="${colors.fg}">` +
    body +
    '</g></svg>'
  );
}

export function toSvg(art: ArtResult, theme: Theme): string {
  const { width, height } = artPixelSize(art);
  return svgDocument(width, height, theme, artToSvgText(art, 0, 0));
}
