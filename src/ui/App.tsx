import { useEffect, useRef, useState } from 'react';
import { CardEditor } from './components/CardEditor';
import { useConfirm } from './components/ConfirmDialog';
import { Controls } from './components/Controls';
import { CropDialog } from './components/CropDialog';
import { Dropzone } from './components/Dropzone';
import { ExportBar } from './components/ExportBar';
import { Gallery } from './components/Gallery';
import { Preview } from './components/Preview';
import { SaveDialog } from './components/SaveDialog';
import { Toasts, useToasts } from './components/Toasts';
import { useStudio } from './studio-state';

type View = 'editor' | 'gallery';

export function App() {
  const { toasts, notify } = useToasts();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const studio = useStudio(notify, confirm);
  const { state, loading } = studio;
  const [view, setView] = useState<View>('editor');
  const [savingAs, setSavingAs] = useState(false);
  const [cropping, setCropping] = useState(false);

  // Fechar ou recarregar a aba perderia o que não foi salvo.
  const hasUnsavedWork = Boolean(state.image && state.dirty);
  useEffect(() => {
    if (!hasUnsavedWork) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedWork]);

  const handleFile = (file: File) => {
    setView('editor');
    void studio.loadFile(file);
  };

  // Soltar e colar valem para a tela inteira.
  const handleFileRef = useRef(handleFile);
  handleFileRef.current = handleFile;
  useEffect(() => {
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files[0];
      if (file) handleFileRef.current(file);
    };
    const onPaste = (e: ClipboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.kind === 'file' && i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        handleFileRef.current(file);
      }
    };
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDrop);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onDrop);
      document.removeEventListener('paste', onPaste);
    };
  }, []);

  const tab = (id: View, label: string) => (
    <button
      type="button"
      aria-current={view === id ? 'page' : undefined}
      className={`min-h-10 border-b-2 px-3 ${view === id ? 'border-accent font-bold text-accent' : 'border-transparent text-muted hover:text-text'}`}
      onClick={() => setView(id)}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-2">
        <h1 className="text-lg font-bold text-accent">
          <span aria-hidden="true">&gt; </span>ascii-studio
        </h1>
        <nav aria-label="Seções" className="flex gap-1">
          {tab('editor', 'Editor')}
          {tab('gallery', 'Galeria')}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 p-4">
        {view === 'gallery' && (
          <Gallery
            notify={notify}
            confirm={confirm}
            onRenamed={studio.onCreationRenamed}
            onDeleted={studio.onCreationDeleted}
            onOpen={async (id) => {
              if (await studio.openById(id)) setView('editor');
            }}
          />
        )}

        {view === 'editor' && !state.image && (
          <>
            <Dropzone onFile={handleFile} compact={false} />
            {loading && <p className="mt-3 text-center text-muted">Abrindo a imagem…</p>}
          </>
        )}

        {view === 'editor' && state.image && (
          <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <div className="order-2 min-w-0 lg:order-1">
              <Controls settings={state.settings} onChange={studio.setSettings} bg={studio.bg} onToggleBackground={studio.setBackgroundRemoval} onOpenCrop={() => setCropping(true)} />
            </div>
            <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-2">
              <Dropzone onFile={handleFile} compact />
              <Preview art={state.art} theme={state.settings.theme} />
              <section className="panel flex flex-wrap items-center gap-2" aria-label="Salvar na galeria">
                <p className="mr-auto min-w-0 wrap-anywhere" data-testid="save-status">
                  <span className="font-bold">{state.openName ?? 'Nova criação'}</span>
                  <span className="text-muted"> · {state.dirty ? 'não salva' : 'salva'}</span>
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!state.art || (state.openId !== null && !state.dirty)}
                  onClick={() => (state.openId ? studio.saveExisting() : setSavingAs(true))}
                >
                  Salvar
                </button>
                <button type="button" className="btn" disabled={!state.art} onClick={() => setSavingAs(true)}>
                  Salvar como nova
                </button>
              </section>
              <ExportBar art={state.art} theme={state.settings.theme} name={state.openName} notify={notify} />
              <CardEditor art={state.art} theme={state.settings.theme} name={state.openName} fields={state.cardFields} onChange={studio.setCardFields} />
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-line-soft px-4 py-2 text-muted">
        Tudo é processado no seu navegador. Suas imagens não são enviadas a servidores.
      </footer>

      {savingAs && (
        <SaveDialog
          title="Salvar na galeria"
          submitLabel="Salvar"
          initialName={state.openName ?? ''}
          onSubmit={studio.saveAsNew}
          onClose={() => setSavingAs(false)}
        />
      )}
      {cropping && state.image && (
        <CropDialog
          image={state.image.working}
          crop={state.settings.crop}
          onApply={(crop) => studio.setSettings({ crop })}
          onClose={() => setCropping(false)}
        />
      )}
      {confirmDialog}
      <Toasts toasts={toasts} />
    </div>
  );
}
