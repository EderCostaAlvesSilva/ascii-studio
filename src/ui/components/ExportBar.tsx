import { toMarkdownBlock, toPlainText, toWhatsAppBlock } from '../../core/export-text';
import { toSvg } from '../../core/export-svg';
import type { ArtResult, Theme } from '../../core/types';
import { copyText } from '../lib/clipboard';
import { downloadBlob, downloadText, fileBaseName } from '../lib/download';
import { renderPng } from '../lib/render-canvas';
import type { Notify } from './Toasts';

interface Props {
  art: ArtResult | null;
  theme: Theme;
  name: string | null;
  notify: Notify;
}

/** Estimativa do que cabe em uma linha monoespaçada do WhatsApp no celular; varia com o aparelho. */
const PHONE_COLUMNS = 35;
const PHONE_EMOJIS = 16;

export function ExportBar({ art, theme, name, notify }: Props) {
  const disabled = !art;
  const base = fileBaseName(name);

  const copy = async (text: string, done: string) => {
    if (await copyText(text)) notify(done);
    else notify('Não foi possível copiar. Permita o acesso à área de transferência ou baixe o arquivo.', 'error');
  };

  const copyForWhatsApp = () => {
    if (!art) return;
    const { text, width } = toWhatsAppBlock(art);
    const hint = width > (art.emoji ? PHONE_EMOJIS : PHONE_COLUMNS) ? ` Com ${width} ${art.emoji ? 'emojis' : 'colunas'} por linha, deve quebrar no celular: reduza a largura ou envie o .png.` : '';
    void copy(text, `Copiado para o WhatsApp.${hint}`);
  };

  const png = async () => {
    if (!art) return;
    try {
      downloadBlob(await renderPng(art, theme), `${base}.png`);
    } catch {
      notify('Não foi possível gerar o PNG.', 'error');
    }
  };

  return (
    <section className="panel" aria-labelledby="export-title">
      <h2 id="export-title" className="mb-3 font-bold">
        Exportar
      </h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" disabled={disabled} onClick={() => art && copy(toPlainText(art), 'Texto copiado.')}>
          Copiar texto
        </button>
        <button type="button" className="btn" disabled={disabled} onClick={() => art && copy(toMarkdownBlock(art), 'Markdown copiado.')}>
          Copiar Markdown
        </button>
        <button type="button" className="btn" disabled={disabled} onClick={copyForWhatsApp}>
          Copiar para WhatsApp
        </button>
        <button
          type="button"
          className="btn"
          disabled={disabled}
          onClick={() => art && downloadText(toPlainText(art), `${base}.txt`, 'text/plain;charset=utf-8')}
        >
          Baixar .txt
        </button>
        <button type="button" className="btn" disabled={disabled} onClick={png}>
          Baixar .png
        </button>
        <button
          type="button"
          className="btn"
          disabled={disabled}
          onClick={() => art && downloadText(toSvg(art, theme), `${base}.svg`, 'image/svg+xml')}
        >
          Baixar .svg
        </button>
      </div>
      <details className="mt-3 text-muted">
        <summary className="cursor-pointer">A arte perdeu a forma ao colar?</summary>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
          <li>Texto só mantém a forma em fonte monoespaçada e em linhas que não quebram.</li>
          <li>WhatsApp: use "Copiar para WhatsApp". No celular, cabem cerca de {PHONE_COLUMNS} colunas de texto ou {PHONE_EMOJIS} emojis; reduza a largura.</li>
          <li>Bloco de notas: desative Formatar &gt; Quebra automática de linha e use a fonte Consolas.</li>
          <li>Para manter a forma em qualquer lugar, envie o .png.</li>
        </ul>
      </details>
      {art?.emoji && <p className="mt-2 text-muted">Os emojis mantêm a cor ao copiar. Os tons variam conforme o aparelho. PNG e SVG usam quadrados nas mesmas cores.</p>}
      {art?.colors && <p className="mt-2 text-muted">Texto, Markdown, WhatsApp e .txt saem sem cor. PNG e SVG mantêm as cores.</p>}
    </section>
  );
}
