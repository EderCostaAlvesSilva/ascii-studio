/** Brilho de -100 a 100. O resultado pode sair de 0 a 255; quem usa decide quando limitar. */
export const applyBrightness = (value: number, brightness: number) => value + brightness * 2.55;

/** Fator clássico de contraste, para valores de -100 a 100. */
export function contrastFactor(contrast: number): number {
  const c = contrast * 2.55;
  return (259 * (c + 255)) / (255 * (259 - c));
}

export const applyContrast = (value: number, factor: number) => (value - 128) * factor + 128;

/** Luminância Rec. 709. */
export const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const MIN_TONE_RANGE = 8;
const STRETCH_PERCENTILE = 0.01;
const LOCAL_STRENGTH = 1.4;
const MAX_GAIN = 3;

/** Soma acumulada de tons e de células visíveis, para calcular médias de vizinhança em tempo constante. */
function integralTones(tones: Float32Array, visible: Uint8Array, cols: number, rows: number) {
  const sum = new Float64Array((cols + 1) * (rows + 1));
  const count = new Uint32Array((cols + 1) * (rows + 1));
  for (let y = 0; y < rows; y++) {
    let rowSum = 0;
    let rowCount = 0;
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (visible[i]) {
        rowSum += tones[i]!;
        rowCount++;
      }
      const at = (y + 1) * (cols + 1) + x + 1;
      sum[at] = sum[at - cols - 1]! + rowSum;
      count[at] = count[at - cols - 1]! + rowCount;
    }
  }
  return { sum, count };
}

/**
 * Contraste automático, ignorando áreas transparentes. Estica os tons e depois realça cada
 * região em relação à vizinhança: revela olhos e barba mesmo quando a imagem já vai do preto
 * ao branco, como numa camisa clara ao lado de um rosto. Multiplica os canais, para a pele
 * não mudar de matiz nem de saturação.
 */
export function enhanceTones(cells: Float32Array, cols: number, rows: number): Float32Array {
  const out = cells.slice();
  const total = cols * rows;
  const tones = new Float32Array(total);
  const visible = new Uint8Array(total);
  const visibleTones: number[] = [];
  for (let i = 0; i < total; i++) {
    const c = i * 4;
    if (cells[c + 3]! < 0.5) continue;
    visible[i] = 1;
    tones[i] = luminance(cells[c]!, cells[c + 1]!, cells[c + 2]!);
    visibleTones.push(tones[i]!);
  }
  if (visibleTones.length === 0) return out;

  visibleTones.sort((a, b) => a - b);
  const low = visibleTones[Math.floor((visibleTones.length - 1) * STRETCH_PERCENTILE)]!;
  const high = visibleTones[Math.ceil((visibleTones.length - 1) * (1 - STRETCH_PERCENTILE))]!;
  if (high - low < MIN_TONE_RANGE) return out;

  const stretched = new Float32Array(total);
  for (let i = 0; i < total; i++) stretched[i] = ((tones[i]! - low) / (high - low)) * 255;

  const { sum, count } = integralTones(stretched, visible, cols, rows);
  const radius = Math.max(2, Math.round(Math.max(cols, rows) / 8));
  for (let y = 0; y < rows; y++) {
    const top = Math.max(0, y - radius);
    const bottom = Math.min(rows, y + radius + 1);
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (!visible[i]) continue;
      const left = Math.max(0, x - radius);
      const right = Math.min(cols, x + radius + 1);
      const a = bottom * (cols + 1) + right;
      const b = top * (cols + 1) + right;
      const c = bottom * (cols + 1) + left;
      const d = top * (cols + 1) + left;
      const mean = (sum[a]! - sum[b]! - sum[c]! + sum[d]!) / (count[a]! - count[b]! - count[c]! + count[d]!);
      const target = Math.min(255, Math.max(0, stretched[i]! + LOCAL_STRENGTH * (stretched[i]! - mean)));
      const gain = Math.min(MAX_GAIN, target / Math.max(tones[i]!, 1));
      const o = i * 4;
      out[o] = cells[o]! * gain;
      out[o + 1] = cells[o + 1]! * gain;
      out[o + 2] = cells[o + 2]! * gain;
    }
  }
  return out;
}

/** Máscara de nitidez sobre a grade de células RGBA, de 0 a 100. O alfa não muda. */
export function sharpen(cells: Float32Array, cols: number, rows: number, amount: number): Float32Array {
  const out = cells.slice();
  if (amount <= 0) return out;
  const strength = (amount / 100) * 2;

  for (let y = 0; y < rows; y++) {
    const up = (y > 0 ? y - 1 : y) * cols;
    const down = (y < rows - 1 ? y + 1 : y) * cols;
    const row = y * cols;
    for (let x = 0; x < cols; x++) {
      const left = x > 0 ? x - 1 : x;
      const right = x < cols - 1 ? x + 1 : x;
      const i = (row + x) * 4;
      for (let c = 0; c < 3; c++) {
        const neighbors =
          (cells[(up + x) * 4 + c]! +
            cells[(down + x) * 4 + c]! +
            cells[(row + left) * 4 + c]! +
            cells[(row + right) * 4 + c]!) /
          4;
        out[i + c] = cells[i + c]! + strength * (cells[i + c]! - neighbors);
      }
    }
  }
  return out;
}
