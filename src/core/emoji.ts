import { luminance } from './adjust';
import type { Theme } from './types';

/** Quadrados coloridos: têm a mesma largura e mantêm a cor ao copiar. */
export const EMOJI_PALETTE = [
  { char: '⬛', hex: '#31373d' },
  { char: '⬜', hex: '#e6e7e8' },
  { char: '🟥', hex: '#dd2e44' },
  { char: '🟧', hex: '#f4900c' },
  { char: '🟨', hex: '#fdcb58' },
  { char: '🟩', hex: '#78b159' },
  { char: '🟦', hex: '#55acee' },
  { char: '🟪', hex: '#aa8ed6' },
  { char: '🟫', hex: '#c1694f' },
] as const;

const HEX_BY_CHAR = new Map<string, string>(EMOJI_PALETTE.map((e) => [e.char, e.hex]));

export const emojiHex = (char: string) => HEX_BY_CHAR.get(char) ?? '#000000';

/** Área transparente: um espaço teria outra largura e desalinharia a linha. */
export const BLANK_EMOJI: Record<Theme, string> = { dark: '⬛', light: '⬜' };

/**
 * Escolhe por matiz e claridade. Distância simples de cor com tão poucas opções
 * levaria azul puro a preto e cinza médio a marrom.
 */
export function nearestEmoji(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  // Barba, olhos e sombras fortes: em tom de pele, virariam marrom e apagariam os traços.
  if (max < 80) return '⬛';
  if (delta / max < 0.2) return luminance(r, g, b) >= 128 ? '⬜' : '⬛';

  let hue: number;
  if (max === r) hue = ((g - b) / delta + 6) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue *= 60;

  const reddish = hue >= 330 || hue < 15;
  // Pele tem matiz de vermelho, mas pouca saturação: só vermelho de verdade vira 🟥.
  if (reddish && delta / max >= 0.55) return '🟥';
  if (reddish || hue < 45) return max / 255 < 0.65 ? '🟫' : '🟧';
  if (hue < 70) return max / 255 < 0.5 ? '🟫' : '🟨';
  if (hue < 170) return '🟩';
  if (hue < 260) return '🟦';
  return '🟪';
}
