import { useCallback, useEffect, useRef, useState } from 'react';
import { exportBackup, importBackupFile } from '../../storage/backup-io';
import { deleteCreation, duplicateCreation, listCreations, renameCreation, type SortOrder } from '../../storage/creations';
import type { CreationRecord } from '../../storage/db';
import { downloadBlob } from '../lib/download';
import type { Confirm } from './ConfirmDialog';
import { SaveDialog } from './SaveDialog';
import type { Notify } from './Toasts';

interface Props {
  notify: Notify;
  confirm: Confirm;
  onOpen: (id: string) => void;
  onRenamed: (id: string, name: string) => void;
  onDeleted: (id: string) => void;
}

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const message = (error: unknown) => (error instanceof Error ? error.message : 'Algo deu errado.');

function Thumbnail({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  return <div className="flex h-36 items-center justify-center bg-bg">{url && <img src={url} alt="" className="max-h-full max-w-full object-contain" />}</div>;
}

export function Gallery({ notify, confirm, onOpen, onRenamed, onDeleted }: Props) {
  const [items, setItems] = useState<CreationRecord[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<SortOrder>('newest');
  const [renaming, setRenaming] = useState<CreationRecord | null>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await listCreations(query, order));
      setLoadError('');
    } catch (error) {
      setLoadError(message(error));
    }
  }, [query, order]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      await refresh();
    } catch (error) {
      notify(message(error), 'error');
    }
  };

  const remove = async (item: CreationRecord) => {
    const ok = await confirm({
      title: `Excluir "${item.name}"?`,
      message: 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await run(async () => {
      await deleteCreation(item.id);
      onDeleted(item.id);
      notify(`"${item.name}" excluída.`);
    });
  };

  const exportAll = () =>
    run(async () => {
      const { blob, count } = await exportBackup();
      downloadBlob(blob, `ascii-studio-backup-${new Date().toISOString().slice(0, 10)}.json`);
      notify(`Backup com ${count} ${count === 1 ? 'criação' : 'criações'} exportado.`);
    });

  const importFile = (file: File) =>
    run(async () => {
      const { added, skipped, copied } = await importBackupFile(file);
      notify(`Importação concluída. Adicionadas: ${added}. Cópias: ${copied}. Ignoradas: ${skipped}.`);
    });

  return (
    <section aria-labelledby="gallery-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="gallery-title" className="text-lg font-bold">
          Galeria
        </h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={exportAll}>
            Exportar backup
          </button>
          <button type="button" className="btn" onClick={() => importInput.current?.click()}>
            Importar backup
          </button>
          <input
            ref={importInput}
            data-testid="import-input"
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importFile(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label htmlFor="gallery-search" className="mb-1 block">
            Buscar por nome
          </label>
          <input id="gallery-search" type="search" className="field" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div>
          <label htmlFor="gallery-order" className="mb-1 block">
            Ordenar por data
          </label>
          <select id="gallery-order" className="field" value={order} onChange={(e) => setOrder(e.target.value as SortOrder)}>
            <option value="newest">Mais recentes</option>
            <option value="oldest">Mais antigas</option>
          </select>
        </div>
      </div>

      {loadError && (
        <p role="alert" className="text-danger">
          {loadError}
        </p>
      )}
      {items?.length === 0 && !loadError && (
        <p className="panel text-center text-muted">
          {query.trim() ? 'Nenhuma criação com esse nome.' : 'Sua galeria está vazia. Gere uma arte no Editor e salve para vê-la aqui.'}
        </p>
      )}

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4">
        {items?.map((item) => (
          <li key={item.id} className="overflow-hidden rounded-md border border-line-soft bg-surface">
            <Thumbnail blob={item.thumbnail} />
            <div className="flex flex-col gap-2 p-3">
              <h3 className="font-bold wrap-anywhere">{item.name}</h3>
              <p className="text-muted">{dateFormat.format(item.updatedAt)}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" aria-label={`Abrir ${item.name}`} onClick={() => onOpen(item.id)}>
                  Abrir
                </button>
                <button type="button" className="btn" aria-label={`Renomear ${item.name}`} onClick={() => setRenaming(item)}>
                  Renomear
                </button>
                <button
                  type="button"
                  className="btn"
                  aria-label={`Duplicar ${item.name}`}
                  onClick={() =>
                    run(async () => {
                      await duplicateCreation(item.id);
                      notify(`"${item.name}" duplicada.`);
                    })
                  }
                >
                  Duplicar
                </button>
                <button type="button" className="btn btn-danger" aria-label={`Excluir ${item.name}`} onClick={() => remove(item)}>
                  Excluir
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {renaming && (
        <SaveDialog
          title="Renomear criação"
          submitLabel="Renomear"
          initialName={renaming.name}
          onClose={() => setRenaming(null)}
          onSubmit={async (name) => {
            await renameCreation(renaming.id, name);
            onRenamed(renaming.id, name);
            await refresh();
          }}
        />
      )}
    </section>
  );
}
