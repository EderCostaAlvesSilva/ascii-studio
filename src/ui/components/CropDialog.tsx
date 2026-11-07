import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { LIMITS, type Crop } from '../../core/types';
import { useModal } from './ConfirmDialog';

interface Props {
  image: Blob;
  crop: Crop | null;
  onApply: (crop: Crop | null) => void;
  onClose: () => void;
}

const WHOLE: Crop = { x: 0, y: 0, width: 1, height: 1 };
const round = (v: number) => Math.round(v * 1000) / 1000;

/** Mantém o recorte dentro da imagem e acima do tamanho mínimo. */
function clampCrop({ x, y, width, height }: Crop): Crop {
  const w = Math.min(1, Math.max(LIMITS.minCrop, width));
  const h = Math.min(1, Math.max(LIMITS.minCrop, height));
  return { x: round(Math.min(1 - w, Math.max(0, x))), y: round(Math.min(1 - h, Math.max(0, y))), width: round(w), height: round(h) };
}

type Drag = { mode: 'move' | 'resize'; startX: number; startY: number; start: Crop; boxW: number; boxH: number };

export function CropDialog({ image, crop, onApply, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useModal(dialog);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [url, setUrl] = useState('');
  const [natural, setNatural] = useState({ width: 1, height: 1 });
  const [area, setArea] = useState<Crop>(crop ?? WHOLE);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(image);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  const startDrag = (mode: Drag['mode']) => (e: ReactPointerEvent<HTMLElement>) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode, startX: e.clientX, startY: e.clientY, start: area, boxW: box.width, boxH: box.height };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / d.boxW;
    const dy = (e.clientY - d.startY) / d.boxH;
    setArea(
      d.mode === 'move'
        ? clampCrop({ ...d.start, x: d.start.x + dx, y: d.start.y + dy })
        : clampCrop({
            ...d.start,
            width: Math.min(1 - d.start.x, d.start.width + dx),
            height: Math.min(1 - d.start.y, d.start.height + dy),
          }),
    );
  };

  const endDrag = () => {
    drag.current = null;
  };

  /** Quadrado em pixels, no centro da área atual. */
  const makeSquare = () => {
    const side = Math.min(area.width * natural.width, area.height * natural.height);
    const width = side / natural.width;
    const height = side / natural.height;
    setArea(clampCrop({ x: area.x + (area.width - width) / 2, y: area.y + (area.height - height) / 2, width, height }));
  };

  const slider = (label: string, key: keyof Crop) => {
    const max = key === 'x' ? 1 - area.width : key === 'y' ? 1 - area.height : key === 'width' ? 1 - area.x : 1 - area.y;
    const min = key === 'width' || key === 'height' ? LIMITS.minCrop : 0;
    return (
      <div>
        <div className="flex justify-between">
          <label htmlFor={`crop-${key}`}>{label}</label>
          <output htmlFor={`crop-${key}`} className="text-muted">
            {Math.round(area[key] * 100)}%
          </output>
        </div>
        <input
          id={`crop-${key}`}
          type="range"
          className="w-full"
          min={Math.round(min * 100)}
          max={Math.round(max * 100)}
          value={Math.round(area[key] * 100)}
          onChange={(e) => setArea(clampCrop({ ...area, [key]: Number(e.target.value) / 100 }))}
        />
      </div>
    );
  };

  return (
    <dialog
      ref={dialog}
      className="dialog"
      style={{ width: 'min(40rem, calc(100vw - 2rem))' }}
      aria-labelledby="crop-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2 id="crop-title" className="mb-1 text-base font-bold">
        Recortar imagem
      </h2>
      <p className="mb-3 text-muted">Deixe só o rosto: com poucas colunas, é o que mais melhora o resultado. O recorte pode ser alterado depois.</p>

      <div className="mb-3 flex justify-center">
        <div ref={frame} data-testid="crop-frame" className="relative overflow-hidden bg-raised" style={{ touchAction: 'none' }}>
          {url && (
            <img
              src={url}
              alt="Imagem a recortar"
              draggable={false}
              className="block max-h-[45vh] max-w-full select-none"
              onLoad={(e) => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
            />
          )}
          <div
            data-testid="crop-box"
            aria-hidden="true"
            className="absolute cursor-move border-2 border-accent"
            style={{
              left: `${area.x * 100}%`,
              top: `${area.y * 100}%`,
              width: `${area.width * 100}%`,
              height: `${area.height * 100}%`,
              boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.6)',
              touchAction: 'none',
            }}
            onPointerDown={startDrag('move')}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div
              data-testid="crop-handle"
              className="absolute -right-2 -bottom-2 size-5 cursor-nwse-resize rounded-sm border-2 border-on-accent bg-accent"
              style={{ touchAction: 'none' }}
              onPointerDown={startDrag('resize')}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        {/* Tamanho primeiro: com a imagem inteira selecionada, ainda não há para onde mover. */}
        {slider('Largura do recorte', 'width')}
        {slider('Altura do recorte', 'height')}
        {slider('Esquerda', 'x')}
        {slider('Topo', 'y')}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn" onClick={makeSquare}>
          Quadrado
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            onApply(null);
            onClose();
          }}
        >
          Usar imagem inteira
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            const whole = area.x === 0 && area.y === 0 && area.width === 1 && area.height === 1;
            onApply(whole ? null : area);
            onClose();
          }}
        >
          Aplicar recorte
        </button>
      </div>
    </dialog>
  );
}
