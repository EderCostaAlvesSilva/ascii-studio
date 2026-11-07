import { DEFAULT_SETTINGS, type RawImage, type Settings } from '../../src/core/types';

type Pixel = [number, number, number, number];

export function makeImage(width: number, height: number, pixel: (x: number, y: number) => Pixel): RawImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set(pixel(x, y), (y * width + x) * 4);
    }
  }
  return { data, width, height };
}

export const solid = (width: number, height: number, v: number, a = 255): RawImage =>
  makeImage(width, height, () => [v, v, v, a]);

export const settings = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...patch });
