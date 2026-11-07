export type Theme = 'dark' | 'light';
export type RampId = 'simple' | 'detailed' | 'blocks' | 'custom' | 'emoji';

/** Área da imagem, em frações de 0 a 1. */
export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Settings {
  width: number;
  rampId: RampId;
  customRamp: string;
  invert: boolean;
  brightness: number;
  contrast: number;
  sharpness: number;
  autoContrast: boolean;
  crop: Crop | null;
  /** Remove a borda das áreas transparentes, em milésimos do maior lado da imagem. */
  trimEdge: number;
  removeBackground: boolean;
  color: boolean;
  theme: Theme;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  width: 100,
  rampId: 'simple',
  customRamp: '',
  invert: false,
  brightness: 0,
  contrast: 0,
  sharpness: 0,
  autoContrast: true,
  crop: null,
  trimEdge: 0,
  removeBackground: false,
  color: false,
  theme: 'dark',
};

export const LIMITS = {
  width: { min: 30, max: 200 },
  emojiWidth: { min: 8, max: 60 },
  brightness: { min: -100, max: 100 },
  contrast: { min: -100, max: 100 },
  sharpness: { min: 0, max: 100 },
  trimEdge: { min: 0, max: 50 },
  customRampLength: 256,
  maxRows: 400,
  maxFileBytes: 25 * 1024 * 1024,
  workingMaxSide: 1024,
  thumbnailMaxSide: 256,
  nameLength: 100,
  minCrop: 0.05,
} as const;

/** Criações antigas não têm estes campos: ficam como eram, para reabrir com a mesma arte. */
export const normalizeSettings = (settings: Settings): Settings => ({ ...settings, autoContrast: settings.autoContrast ?? false, crop: settings.crop ?? null, trimEdge: settings.trimEdge ?? 0 });

export const EMOJI_DEFAULT_WIDTH = 14;

export const widthLimits = (rampId: RampId) => (rampId === 'emoji' ? LIMITS.emojiWidth : LIMITS.width);

/** Largura do caractere dividida pela altura; compensa a célula não ser quadrada. */
export const CHAR_ASPECT = 0.5;

/** Grade usada em PNG e SVG. */
export const CELL = { width: 10, height: 20, fontSize: 16 } as const;

/** Emojis são quadrados. */
export const EMOJI_CELL = 20;

export const FONT_STACK = "ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace";

/** Opacidade dos blocos Unicode, desenhados como retângulos para não depender da fonte. */
export const BLOCK_ALPHA: Readonly<Record<string, number>> = { '░': 0.25, '▒': 0.5, '▓': 0.75, '█': 1 };

export const THEME_COLORS: Record<Theme, { bg: string; fg: string; accent: string; bar: string }> = {
  dark: { bg: '#0d1117', fg: '#c9d1d9', accent: '#7ee787', bar: '#30363d' },
  light: { bg: '#ffffff', fg: '#1f2328', accent: '#116329', bar: '#d0d7de' },
};

/** Imagem RGBA não pré-multiplicada. */
export interface RawImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface ArtResult {
  cols: number;
  rows: number;
  lines: string[];
  /** RGB por célula (cols × rows × 3), só no modo colorido. */
  colors: Uint8ClampedArray | null;
  /** Cada célula é um emoji da paleta. */
  emoji?: boolean;
}

/** Tamanho da arte em PNG e SVG. */
export function artPixelSize(art: Pick<ArtResult, 'cols' | 'rows' | 'emoji'>): { width: number; height: number } {
  return art.emoji
    ? { width: art.cols * EMOJI_CELL, height: art.rows * EMOJI_CELL }
    : { width: art.cols * CELL.width, height: art.rows * CELL.height };
}

export interface CardField {
  id: string;
  label: string;
  value: string;
}

/** Devolve o nome pronto para salvar ou uma mensagem de erro. */
export function validateName(input: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = input.trim();
  if (!name) return { ok: false, error: 'Informe um nome.' };
  if (name.length > LIMITS.nameLength) {
    return { ok: false, error: `Use no máximo ${LIMITS.nameLength} caracteres.` };
  }
  return { ok: true, name };
}
