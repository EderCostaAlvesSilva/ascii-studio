import type { FromBgWorker, ToBgWorker } from '../../workers/protocol';
import { canvasToBlob, context2d, createCanvas } from './canvas';

export type BgProgress = { phase: 'download'; percent: number } | { phase: 'processing' };

declare global {
  interface Window {
    __BG_STUB_FAIL__?: boolean;
    __BG_STUB_CALLS__?: number;
  }
}

/** Motor simulado para os testes: remove a metade de cima da imagem, sem rede. */
async function stubEngine(image: Blob, onProgress: (p: BgProgress) => void): Promise<Blob> {
  window.__BG_STUB_CALLS__ = (window.__BG_STUB_CALLS__ ?? 0) + 1;
  onProgress({ phase: 'download', percent: 50 });
  if (window.__BG_STUB_FAIL__) throw new Error('falha simulada');
  const bitmap = await createImageBitmap(image);
  const canvas = createCanvas(bitmap.width, bitmap.height);
  const ctx = context2d(canvas);
  ctx.drawImage(bitmap, 0, 0);
  ctx.clearRect(0, 0, bitmap.width, Math.floor(bitmap.height / 2));
  bitmap.close();
  return canvasToBlob(canvas, 'image/png');
}

let worker: Worker | null = null;
let nextId = 0;

function realEngine(image: Blob, onProgress: (p: BgProgress) => void): Promise<Blob> {
  // O Worker, que importa a biblioteca, só é criado na primeira ativação confirmada.
  worker ??= new Worker(new URL('../../workers/bg-removal.worker.ts', import.meta.url), { type: 'module' });
  const current = worker;
  const requestId = ++nextId;

  return new Promise((resolve, reject) => {
    const onMessage = ({ data }: MessageEvent<FromBgWorker>) => {
      if (data.requestId !== requestId) return;
      if (data.type === 'progress') {
        if (data.key.startsWith('fetch:') && data.total > 0) {
          onProgress({ phase: 'download', percent: Math.round((data.current / data.total) * 100) });
        } else {
          onProgress({ phase: 'processing' });
        }
        return;
      }
      cleanup();
      if (data.type === 'done') resolve(data.cutout);
      else reject(new Error(data.message));
    };
    const onError = () => {
      cleanup();
      worker = null;
      reject(new Error('Falha ao carregar a remoção de fundo.'));
    };
    const cleanup = () => {
      current.removeEventListener('message', onMessage);
      current.removeEventListener('error', onError);
    };
    current.addEventListener('message', onMessage);
    current.addEventListener('error', onError);
    const message: ToBgWorker = { type: 'remove', requestId, image };
    current.postMessage(message);
  });
}

export const removeBackground = import.meta.env.VITE_BG_REMOVAL_STUB === '1' ? stubEngine : realEngine;
