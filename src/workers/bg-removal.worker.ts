import type { FromBgWorker, ToBgWorker } from './protocol';

// Só GETs de arquivos estáticos; a imagem é processada aqui e não sai do dispositivo.
// Para hospedar os arquivos por conta própria, troque este endereço.
const PUBLIC_PATH = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const reply = (message: FromBgWorker) => scope.postMessage(message);

scope.onmessage = async ({ data: { requestId, image } }: MessageEvent<ToBgWorker>) => {
  try {
    const { removeBackground } = await import('@imgly/background-removal');
    const cutout = await removeBackground(image, {
      publicPath: PUBLIC_PATH,
      model: 'isnet_quint8',
      device: 'cpu',
      output: { format: 'image/png' },
      progress: (key, current, total) => reply({ type: 'progress', requestId, key, current, total }),
    });
    reply({ type: 'done', requestId, cutout });
  } catch (error) {
    reply({ type: 'error', requestId, message: String(error) });
  }
};
