import { artToSvgText, escapeXml, keepSpaces, svgDocument } from './export-svg';
import { CELL, THEME_COLORS, artPixelSize, type ArtResult, type CardField, type Theme } from './types';

const PADDING = 24;
const GAP = 40;
const TITLE_BAR = 32;
const LINE_HEIGHT = 24;
const INFO_CHARS = 48;
const INFO_WIDTH = INFO_CHARS * CELL.width;
const PALETTE = ['#ff7b72', '#ffa657', '#d29922', '#7ee787', '#79c0ff', '#a5a0ff', '#ff9bce', '#8b949e'];

export function defaultCardFields(): CardField[] {
  return ['Nome', 'Usuário', 'Linguagens', 'Hobbies', 'Contato'].map((label, i) => ({
    id: `campo-${i}`,
    label,
    value: '',
  }));
}

/** Quebra por palavras; palavras maiores que a linha são cortadas. */
function wrap(text: string, firstWidth: number, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  let limit = firstWidth;
  const push = () => {
    lines.push(line);
    line = '';
    limit = width;
  };
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let rest = Array.from(word);
    if (line && line.length + 1 + rest.length > limit) push();
    if (line) line += ' ';
    while (Array.from(line).length + rest.length > limit) {
      const room = limit - Array.from(line).length;
      line += rest.slice(0, room).join('');
      rest = rest.slice(room);
      push();
    }
    line += rest.join('');
  }
  if (line || lines.length === 0) lines.push(line);
  return lines;
}

/** Texto pronto para o SVG: escapado e com espaços que não colapsam. */
const text = (value: string) => keepSpaces(escapeXml(value));

function infoLines(fields: CardField[], x: number, top: number, theme: Theme): { svg: string; height: number } {
  const accent = THEME_COLORS[theme].accent;
  const visible = fields.filter((f) => f.label.trim() || f.value.trim());
  const title =
    visible.find((f) => f.label.trim().toLowerCase() === 'usuário' && f.value.trim()) ?? visible.find((f) => f.value.trim());

  let y = top + LINE_HEIGHT * 0.75;
  let svg = '';
  const add = (content: string) => {
    svg += `<text x="${x}" y="${y}">${content}</text>`;
    y += LINE_HEIGHT;
  };

  if (title) {
    const [head = ''] = wrap(title.value.trim(), INFO_CHARS, INFO_CHARS);
    add(`<tspan fill="${accent}" font-weight="bold">${text(head)}</tspan>`);
    add('-'.repeat(Math.max(3, Array.from(head).length)));
  }

  for (const field of visible) {
    const label = field.label.trim();
    const prefix = label ? `${label}: ` : '';
    const firstWidth = Math.max(1, INFO_CHARS - Array.from(prefix).length);
    const [first = '', ...rest] = wrap(field.value.trim(), firstWidth, INFO_CHARS);
    const labelSvg = label ? `<tspan fill="${accent}" font-weight="bold">${text(`${label}:`)}</tspan>${text(' ')}` : '';
    add(labelSvg + text(first));
    rest.forEach((line) => add(text(line)));
  }

  y += LINE_HEIGHT * 0.25;
  PALETTE.forEach((color, i) => {
    svg += `<rect x="${x + i * 24}" y="${y}" width="24" height="16" fill="${color}"/>`;
  });
  y += 16;
  return { svg, height: y - top };
}

/** Cartão estilo terminal: arte à esquerda, informações à direita. */
export function toCardSvg(art: ArtResult, fields: CardField[], theme: Theme): string {
  const colors = THEME_COLORS[theme];
  const { width: artWidth, height: artHeight } = artPixelSize(art);
  const infoX = PADDING + artWidth + GAP;
  const top = TITLE_BAR + PADDING;
  const info = infoLines(fields, infoX, top, theme);

  const width = infoX + INFO_WIDTH + PADDING;
  const height = top + Math.max(artHeight, info.height) + PADDING;
  const titleBar =
    `<rect width="${width}" height="${TITLE_BAR}" fill="${colors.bar}"/>` +
    ['#ff7b72', '#d29922', '#7ee787'].map((c, i) => `<circle cx="${20 + i * 20}" cy="${TITLE_BAR / 2}" r="6" fill="${c}"/>`).join('');

  return svgDocument(width, height, theme, titleBar + artToSvgText(art, PADDING, top) + info.svg);
}
