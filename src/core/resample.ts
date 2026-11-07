import { CHAR_ASPECT, LIMITS, type Crop, type RawImage } from './types';

export function computeRows(srcWidth: number, srcHeight: number, cols: number, aspect = CHAR_ASPECT): number {
  const rows = Math.round((srcHeight / srcWidth) * cols * aspect);
  return Math.min(LIMITS.maxRows, Math.max(1, rows));
}

/** Espessura da borda em pixels: proporcional, para valer igual em qualquer resolução. */
export function trimRadius(trimEdge: number, width: number, height: number): number {
  return Math.max(1, Math.round((trimEdge / 1000) * Math.max(width, height)));
}

/**
 * Apaga tudo o que estiver a menos de `radius` pixels de uma área transparente, como o contorno
 * branco de figurinhas. O lado de fora da imagem não conta como transparente. Usa soma acumulada
 * de pixels transparentes, para o custo não crescer com a espessura.
 */
export function erodeEdges(image: RawImage, radius: number): RawImage {
  const { data, width, height } = image;
  const stride = width + 1;
  const clear = new Uint32Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! < 128) row++;
      clear[(y + 1) * stride + x + 1] = clear[y * stride + x + 1]! + row;
    }
  }

  const out = new Uint8ClampedArray(data);
  for (let y = 0; y < height; y++) {
    const top = Math.max(0, y - radius);
    const bottom = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x++) {
      const left = Math.max(0, x - radius);
      const right = Math.min(width, x + radius + 1);
      const nearby = clear[bottom * stride + right]! - clear[top * stride + right]! - clear[bottom * stride + left]! + clear[top * stride + left]!;
      if (nearby > 0) out[(y * width + x) * 4 + 3] = 0;
    }
  }
  return { data: out, width, height };
}

export function cropImage(image: RawImage, crop: Crop): RawImage {
  const left = Math.min(image.width - 1, Math.max(0, Math.round(crop.x * image.width)));
  const top = Math.min(image.height - 1, Math.max(0, Math.round(crop.y * image.height)));
  const width = Math.min(image.width - left, Math.max(1, Math.round(crop.width * image.width)));
  const height = Math.min(image.height - top, Math.max(1, Math.round(crop.height * image.height)));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const start = ((top + y) * image.width + left) * 4;
    data.set(image.data.subarray(start, start + width * 4), y * width * 4);
  }
  return { data, width, height };
}

/** Para cada célula, os pixels de origem que ela cobre e o peso de cada um. */
function coverage(srcSize: number, dstSize: number) {
  const scale = srcSize / dstSize;
  return Array.from({ length: dstSize }, (_, i) => {
    const start = i * scale;
    const end = (i + 1) * scale;
    const first = Math.floor(start);
    const last = Math.min(srcSize - 1, Math.ceil(end) - 1);
    const weights: number[] = [];
    for (let p = first; p <= last; p++) {
      weights.push(Math.min(end, p + 1) - Math.max(start, p));
    }
    return { first, weights };
  });
}

/**
 * Reduz a imagem por média de área. Devolve RGBA por célula, com RGB de 0 a 255
 * (ponderado pelo alfa, para o fundo transparente não contaminar a cor) e alfa de 0 a 1.
 */
export function areaResample(image: RawImage, cols: number, rows: number): Float32Array {
  const { data, width } = image;
  const xs = coverage(width, cols);
  const ys = coverage(image.height, rows);
  const cells = new Float32Array(cols * rows * 4);

  for (let cy = 0; cy < rows; cy++) {
    const y = ys[cy]!;
    for (let cx = 0; cx < cols; cx++) {
      const x = xs[cx]!;
      let r = 0;
      let g = 0;
      let b = 0;
      let alpha = 0;
      let area = 0;
      for (let j = 0; j < y.weights.length; j++) {
        const row = (y.first + j) * width;
        const wy = y.weights[j]!;
        for (let i = 0; i < x.weights.length; i++) {
          const offset = (row + x.first + i) * 4;
          const weight = wy * x.weights[i]!;
          const a = (data[offset + 3]! / 255) * weight;
          r += data[offset]! * a;
          g += data[offset + 1]! * a;
          b += data[offset + 2]! * a;
          alpha += a;
          area += weight;
        }
      }
      const out = (cy * cols + cx) * 4;
      if (alpha > 0) {
        cells[out] = r / alpha;
        cells[out + 1] = g / alpha;
        cells[out + 2] = b / alpha;
        cells[out + 3] = alpha / area;
      }
    }
  }
  return cells;
}
