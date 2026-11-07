import { useRef, useState, type FormEvent } from 'react';
import { LIMITS, validateName } from '../../core/types';
import { useModal } from './ConfirmDialog';

interface Props {
  title: string;
  submitLabel: string;
  initialName: string;
  /** Pode rejeitar com mensagem, que aparece no próprio diálogo. */
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}

/** Pede um nome, para salvar ou renomear. */
export function SaveDialog({ title, submitLabel, initialName, onSubmit, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useModal(ref);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validateName(name);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(result.name);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="save-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <form onSubmit={submit} noValidate>
        <h2 id="save-title" className="mb-3 text-base font-bold">
          {title}
        </h2>
        <label htmlFor="save-name" className="mb-1 block">
          Nome
        </label>
        <input
          id="save-name"
          className="field"
          value={name}
          maxLength={LIMITS.nameLength + 20}
          autoFocus
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'save-error' : undefined}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
        />
        {error && (
          <p id="save-error" role="alert" className="mt-2 text-danger">
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
