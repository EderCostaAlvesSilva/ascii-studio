import { EMOJI_PALETTE } from './emoji';
import { LIMITS, type Settings } from './types';

const PRESETS = {
  simple: ' .:-=+*#%@',
  // Rampa clássica de 70 caracteres de Paul Bourke, do menos para o mais denso.
  detailed: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  blocks: ' ░▒▓█',
  emoji: EMOJI_PALETTE.map((e) => e.char).join(''),
} as const;

/** Caracteres que quebrariam o alinhamento: largura dupla, emoji e largura zero. */
const MISALIGNING_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0300, 0x036f], // marcas combinantes
  [0x1100, 0x115f],
  [0x200b, 0x200f], // largura zero
  [0x2028, 0x202e],
  [0x2060, 0x206f],
  [0x2600, 0x27bf], // símbolos que costumam virar emoji
  [0x2e80, 0x303e],
  [0x3041, 0x4dbf],
  [0x4e00, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe00, 0xfe0f], // seletores de variação
  [0xfe30, 0xfe6f],
  [0xfeff, 0xfeff],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1f000, 0x1faff],
  [0x20000, 0x3fffd],
];

const isControl = (cp: number) => cp < 0x20 || (cp >= 0x7f && cp <= 0x9f);
const isMisaligning = (cp: number) => MISALIGNING_RANGES.some(([from, to]) => cp >= from && cp <= to);

export function validateCustomRamp(input: string): { ok: true } | { ok: false; error: string } {
  const chars = Array.from(input);
  if (chars.length === 0) return { ok: false, error: 'Digite pelo menos um caractere.' };
  if (chars.length > LIMITS.customRampLength) {
    return { ok: false, error: `Use no máximo ${LIMITS.customRampLength} caracteres.` };
  }
  for (const ch of chars) {
    const cp = ch.codePointAt(0)!;
    if (isControl(cp)) return { ok: false, error: 'Remova tabulações, quebras de linha e caracteres de controle.' };
    if (isMisaligning(cp)) {
      return { ok: false, error: `O caractere "${ch}" quebraria o alinhamento da arte. Emoji e caracteres largos não são aceitos.` };
    }
  }
  return { ok: true };
}

export function getRamp({ rampId, customRamp }: Pick<Settings, 'rampId' | 'customRamp'>): string[] {
  return Array.from(rampId === 'custom' ? customRamp : PRESETS[rampId]);
}
