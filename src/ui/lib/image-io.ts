import { LIMITS, type RawImage } from '../../core/types';
import { canvasToBlob, context2d, createCanvas, type AnyCanvas } from './canvas';

/** Erro com mensagem pronta para mostrar à pessoa. */
export class ImageInputError extends Error {}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ACCEPT_ATTRIBUTE = ACCEPTED_TYPES.join(',');

export function checkFile(file: File): void {
  const typeOk = file.type ? ACCEPTED_TYPES.includes(file.type) : /\.(jpe?g|png|webp)$/i.test(file.name);
  if (!typeOk) throw new ImageInputError('Formato não aceito. Envie uma imagem JPG, PNG ou WEBP.');
  if (file.size > LIMITS.maxFileBytes) {
    throw new ImageInputError(`A imagem passa do limite de ${LIMITS.maxFileBytes / (1024 * 1024)} MB. Escolha um arquivo menor.`);
  }
}

function drawScaled(bitmap: ImageBitmap, maxSide: number): AnyCanvas {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = createCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
  const ctx = context2d(canvas);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function decodeToRaw(blob: Blob): Promise<RawImage> {
  const bitmap = await createImageBitmap(blob);
  const canvas = createCanvas(bitmap.width, bitmap.height);
  const ctx = context2d(canvas, { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data, width, height };
}

export interface PreparedImage {
  working: Blob;
  thumbnail: Blob;
  raw: RawImage;
}

/**
 * Reduz a imagem, codifica em PNG e decodifica de volta. A sessão trabalha com o
 * resultado dessa volta, para que reabrir uma criação gere exatamente a mesma arte.
 */
export async function prepareImage(file: Blob): Promise<PreparedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageInputError('Não foi possível ler a imagem. O arquivo pode estar corrompido.');
  }
  const working = await canvasToBlob(drawScaled(bitmap, LIMITS.workingMaxSide), 'image/png');
  const thumbnail = await canvasToBlob(drawScaled(bitmap, LIMITS.thumbnailMaxSide), 'image/webp', 0.8);
  bitmap.close();
  return { working, thumbnail, raw: await decodeToRaw(working) };
}
