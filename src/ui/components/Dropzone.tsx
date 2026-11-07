import { useRef, useState } from 'react';
import { ACCEPT_ATTRIBUTE } from '../lib/image-io';

interface Props {
  onFile: (file: File) => void;
  compact: boolean;
}

/** O soltar e o colar são tratados no documento (App), para funcionar em toda a tela. */
export function Dropzone({ onFile, compact }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div
      data-testid="dropzone"
      onDragEnter={() => setOver(true)}
      onDragOver={() => setOver(true)}
      onDragLeave={() => setOver(false)}
      onDrop={() => setOver(false)}
      className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-center ${
        over ? 'border-accent bg-raised' : 'border-line'
      } ${compact ? 'p-3 sm:flex-row sm:gap-4' : 'min-h-[50vh] p-8'}`}
    >
      {!compact && (
        <>
          <pre aria-hidden="true" className="mb-2 text-accent">
            {'  .:*#@  \n .:*#@#*:. \n  .:*#@  '}
          </pre>
          <h2 className="text-lg font-bold">Transforme uma imagem em ASCII art</h2>
        </>
      )}
      <p className="text-muted">
        {compact ? 'Arraste, cole ou' : 'Arraste uma imagem para cá, cole com Ctrl+V ou'}
      </p>
      <button type="button" className={compact ? 'btn' : 'btn btn-primary'} onClick={() => input.current?.click()}>
        {compact ? 'Trocar imagem' : 'Escolher imagem'}
      </button>
      <input
        ref={input}
        data-testid="file-input"
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
      {!compact && <p className="text-muted">JPG, PNG ou WEBP, até 25 MB. A imagem não sai do seu dispositivo.</p>}
    </div>
  );
}
