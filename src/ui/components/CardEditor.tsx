import { useMemo, useRef, useState } from 'react';
import { toCardSvg } from '../../core/card';
import type { ArtResult, CardField, Theme } from '../../core/types';
import { downloadText, fileBaseName } from '../lib/download';

interface Props {
  art: ArtResult | null;
  theme: Theme;
  name: string | null;
  fields: CardField[];
  onChange: (fields: CardField[]) => void;
}

export function CardEditor({ art, theme, name, fields, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const svg = useMemo(() => (open && art ? toCardSvg(art, fields, theme) : ''), [open, art, fields, theme]);

  const patch = (id: string, change: Partial<CardField>) => onChange(fields.map((f) => (f.id === id ? { ...f, ...change } : f)));

  return (
    <details className="panel" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer font-bold">Cartão estilo neofetch (opcional)</summary>
      {open && (
        <div className="mt-4 flex flex-col gap-4">
          <ul className="flex flex-col gap-3">
            {fields.map((field, index) => (
              <li key={field.id} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-2">
                <input
                  className="field"
                  aria-label={`Rótulo do campo ${index + 1}`}
                  placeholder="Rótulo"
                  value={field.label}
                  onChange={(e) => patch(field.id, { label: e.target.value })}
                />
                <input
                  className="field"
                  aria-label={`Valor de ${field.label || `campo ${index + 1}`}`}
                  placeholder="Valor"
                  value={field.value}
                  onChange={(e) => patch(field.id, { value: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-danger"
                  aria-label={`Remover ${field.label || `campo ${index + 1}`}`}
                  onClick={() => {
                    onChange(fields.filter((f) => f.id !== field.id));
                    addButton.current?.focus();
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              ref={addButton}
              type="button"
              className="btn"
              onClick={() => onChange([...fields, { id: crypto.randomUUID(), label: '', value: '' }])}
            >
              Adicionar campo
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!svg}
              onClick={() => downloadText(svg, `${fileBaseName(name)}-cartao.svg`, 'image/svg+xml')}
            >
              Baixar cartão .svg
            </button>
          </div>
          {svg && (
            <div className="overflow-auto rounded border border-line-soft" tabIndex={0} role="region" aria-label="Pré-visualização do cartão">
              {/* Via <img>, o SVG não executa nada, mesmo com texto digitado. */}
              <img
                data-testid="cartao"
                className="max-w-full"
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
                alt={`Cartão com a arte à esquerda e informações à direita: ${fields
                  .filter((f) => f.value.trim())
                  .map((f) => `${f.label}: ${f.value}`)
                  .join('; ')}`}
              />
            </div>
          )}
        </div>
      )}
    </details>
  );
}
