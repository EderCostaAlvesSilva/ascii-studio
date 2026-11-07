import type { ArtResult, Settings } from '../core/types';

export type ImageKey = 'working' | 'cutout';

export type ToConvertWorker =
  | { type: 'setImage'; imageKey: ImageKey; data: ArrayBuffer; width: number; height: number }
  | { type: 'convert'; requestId: number; imageKey: ImageKey; settings: Settings };

export type FromConvertWorker =
  | { type: 'result'; requestId: number; result: ArtResult }
  | { type: 'error'; requestId: number; message: string };

export type ToBgWorker = { type: 'remove'; requestId: number; image: Blob };

export type FromBgWorker =
  | { type: 'progress'; requestId: number; key: string; current: number; total: number }
  | { type: 'done'; requestId: number; cutout: Blob }
  | { type: 'error'; requestId: number; message: string };
