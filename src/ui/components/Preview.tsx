import { useEffect, useMemo, useRef, useState } from 'react';
import { BLOCK_ALPHA, FONT_STACK, THEME_COLORS, artPixelSize, type ArtResult, type Theme } from '../../core/types';
import { drawArt } from '../lib/render-canvas';

const MAX_FONT = 16;
const MIN_FONT = 3;
const PADDING = 8;
const MAX_EMOJI = 24;
const MIN_EMOJI = 4;

/** Largura do caractere em relação ao tamanho da fonte. */
function measureCharRatio(): number {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return 0.6;
  ctx.font = `100px ${FONT_STACK}`;
  return ctx.measureText('M').width / 100;
}

const hasBlocks = (art: ArtResult) => art.lines.some((line) => Array.from(line).some((ch) => BLOCK_ALPHA[ch] !== undefined));

export function Preview({ art, theme }: { art: ArtResult | null; theme: Theme }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const ratio = useMemo(measureCharRatio, []);
  // Em texto, cor exigiria milhares de elementos e blocos dependeriam da fonte, com frestas.
  const useCanvas = useMemo(() => Boolean(art && (art.emoji || art.colors || hasBlocks(art))), [art]);

  useEffect(() => {
    if (!box.current) return;
    const observer = new ResizeObserver(([entry]) => setBoxWidth(entry!.contentRect.width));
    observer.observe(box.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (ctx && art && useCanvas) drawArt(ctx, art, theme);
  }, [art, theme, useCanvas]);

  const { bg, fg } = THEME_COLORS[theme];
  const cols = art?.cols ?? 1;
  const fitted = Math.floor((boxWidth / (cols * ratio)) * 100) / 100;
  const fontSize = Math.min(MAX_FONT, Math.max(MIN_FONT, fitted || MIN_FONT));
  // Mantém a célula em proporção de 1 para 2, seja qual for a fonte do sistema.
  const lineHeight = fontSize * ratio * 2;
  const label = art ? `Arte ${art.emoji ? 'em emojis' : 'ASCII'} com ${art.cols} colunas e ${art.rows} linhas` : '';
  const emojiSize = Math.min(MAX_EMOJI, Math.max(MIN_EMOJI, Math.floor((boxWidth / cols) * 100) / 100 || MIN_EMOJI));
  const pixels = art && artPixelSize(art);

  return (
    <div
      ref={box}
      role="region"
      aria-label="Pré-visualização"
      tabIndex={0}
      data-testid="preview"
      className="max-h-[75vh] min-h-48 overflow-auto rounded-md border border-line-soft"
      style={{ background: bg, color: fg, padding: PADDING }}
    >
      {!art && <p>Convertendo…</p>}
      {art && !useCanvas && (
        <pre
          role="img"
          aria-label={label}
          data-testid="arte"
          className="w-fit"
          style={{ fontFamily: FONT_STACK, fontSize, lineHeight: `${lineHeight}px` }}
        >
          {art.lines.join('\n')}
        </pre>
      )}
      {art && useCanvas && (
        <canvas
          ref={canvas}
          role="img"
          aria-label={art.colors ? `${label}, em cores` : label}
          data-testid="arte-canvas"
          width={pixels!.width}
          height={pixels!.height}
          style={
            art.emoji
              ? { width: art.cols * emojiSize, height: art.rows * emojiSize, maxWidth: 'none' }
              : { width: art.cols * fontSize * ratio, height: art.rows * lineHeight, maxWidth: 'none' }
          }
        />
      )}
    </div>
  );
}
