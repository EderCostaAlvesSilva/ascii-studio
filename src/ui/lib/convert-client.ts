import type { ArtResult, RawImage, Settings } from '../../core/types';
import type { FromConvertWorker, ImageKey, ToConvertWorker } from '../../workers/protocol';

/**
 * "Último pedido vence": no máximo um pedido em execução e um pendente.
 * Um pedido novo substitui o pendente, e resultados antigos são descartados.
 */
export class ConversionClient {
  private readonly worker = new Worker(new URL('../../workers/convert.worker.ts', import.meta.url), { type: 'module' });
  private latestId = 0;
  private busy = false;
  private pending: ToConvertWorker | null = null;

  constructor(onResult: (art: ArtResult) => void, onError: (message: string) => void) {
    this.worker.onmessage = ({ data }: MessageEvent<FromConvertWorker>) => {
      this.busy = false;
      if (data.requestId === this.latestId) {
        if (data.type === 'result') onResult(data.result);
        else onError(data.message);
      }
      if (this.pending) {
        const next = this.pending;
        this.pending = null;
        this.post(next);
      }
    };
    this.worker.onerror = () => onError('Falha ao carregar o conversor.');
  }

  private post(message: ToConvertWorker) {
    this.busy = true;
    this.worker.postMessage(message);
  }

  /** Transfere a imagem ao Worker; o buffer deixa de valer aqui. */
  setImage(imageKey: ImageKey, { data, width, height }: RawImage) {
    const buffer = data.buffer as ArrayBuffer;
    const message: ToConvertWorker = { type: 'setImage', imageKey, data: buffer, width, height };
    this.worker.postMessage(message, [buffer]);
  }

  convert(imageKey: ImageKey, settings: Settings) {
    const message: ToConvertWorker = { type: 'convert', requestId: ++this.latestId, imageKey, settings };
    if (this.busy) this.pending = message;
    else this.post(message);
  }
}
