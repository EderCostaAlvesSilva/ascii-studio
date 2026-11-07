import { convert } from '../core/convert';
import type { RawImage } from '../core/types';
import type { FromConvertWorker, ImageKey, ToConvertWorker } from './protocol';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const images = new Map<ImageKey, RawImage>();

const reply = (message: FromConvertWorker, transfer: Transferable[] = []) => scope.postMessage(message, transfer);

scope.onmessage = ({ data: message }: MessageEvent<ToConvertWorker>) => {
  if (message.type === 'setImage') {
    images.set(message.imageKey, {
      data: new Uint8ClampedArray(message.data),
      width: message.width,
      height: message.height,
    });
    return;
  }
  const image = images.get(message.imageKey);
  if (!image) {
    reply({ type: 'error', requestId: message.requestId, message: 'Imagem indisponível.' });
    return;
  }
  try {
    const result = convert(image, message.settings);
    reply({ type: 'result', requestId: message.requestId, result }, result.colors ? [result.colors.buffer as ArrayBuffer] : []);
  } catch (error) {
    reply({ type: 'error', requestId: message.requestId, message: String(error) });
  }
};
