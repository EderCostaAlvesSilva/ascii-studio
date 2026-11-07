import { applyBrightness, applyContrast, contrastFactor, enhanceTones, luminance, sharpen } from './adjust';
import { BLANK_EMOJI, nearestEmoji } from './emoji';
import { getRamp } from './ramps';
import { areaResample, computeRows, cropImage, erodeEdges, trimRadius } from './resample';
import type { ArtResult, RawImage, Settings } from './types';

const clampByte = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

export function convert(fullImage: RawImage, settings: Settings): ArtResult {
  // A borda sai antes do recorte: o que fica fora dele ainda define onde está o contorno.
  const trimmed = settings.trimEdge > 0 ? erodeEdges(fullImage, trimRadius(settings.trimEdge, fullImage.width, fullImage.height)) : fullImage;
  const image = settings.crop ? cropImage(trimmed, settings.crop) : trimmed;
  const cols = settings.width;
  const emoji = settings.rampId === 'emoji';
  // O emoji é quadrado: não há proporção a corrigir.
  const rows = computeRows(image.width, image.height, cols, emoji ? 1 : undefined);
  const resampled = areaResample(image, cols, rows);
  const cells = sharpen(settings.autoContrast ? enhanceTones(resampled, cols, rows) : resampled, cols, rows, settings.sharpness);
  const ramp = getRamp(settings);
  const factor = contrastFactor(settings.contrast);
  // O tema é o fundo onde a arte será usada: no claro, o denso representa o escuro.
  const invert = settings.invert !== (settings.theme === 'light');
  const colors = settings.color && !emoji ? new Uint8ClampedArray(cols * rows * 3) : null;
  const adjust = (v: number) => clampByte(applyContrast(applyBrightness(v, settings.brightness), factor));

  const lines: string[] = [];
  for (let y = 0; y < rows; y++) {
    let line = '';
    for (let x = 0; x < cols; x++) {
      const cell = y * cols + x;
      const i = cell * 4;
      // Área transparente fica sempre em branco, mesmo com inversão.
      if (cells[i + 3]! < 0.5) {
        line += emoji ? BLANK_EMOJI[settings.theme] : ' ';
        continue;
      }
      const r = adjust(cells[i]!);
      const g = adjust(cells[i + 1]!);
      const b = adjust(cells[i + 2]!);
      if (emoji) {
        line += nearestEmoji(r, g, b);
        continue;
      }
      const level = luminance(r, g, b) / 255;
      const density = invert ? 1 - level : level;
      line += ramp[Math.min(ramp.length - 1, Math.floor(density * ramp.length))];
      if (colors) {
        colors[cell * 3] = r;
        colors[cell * 3 + 1] = g;
        colors[cell * 3 + 2] = b;
      }
    }
    lines.push(line);
  }
  return emoji ? { cols, rows, lines, colors, emoji } : { cols, rows, lines, colors };
}
