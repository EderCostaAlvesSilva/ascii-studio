import { useCallback, useRef, useState } from 'react';

export type Notify = (message: string, kind?: 'info' | 'error') => void;

interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'error';
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const notify = useCallback<Notify>((message, kind = 'info') => {
    const id = ++nextId.current;
    setToasts((list) => [...list, { id, message, kind }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 7000);
  }, []);

  return { toasts, notify };
}

/** Região sempre presente, para os avisos serem anunciados por leitores de tela. */
export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <p
          key={t.id}
          className={`max-w-md rounded border bg-raised px-3 py-2 shadow-lg ${t.kind === 'error' ? 'border-danger text-danger' : 'border-accent'}`}
        >
          {t.message}
        </p>
      ))}
    </div>
  );
}
