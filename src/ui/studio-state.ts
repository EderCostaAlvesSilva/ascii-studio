import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { defaultCardFields } from '../core/card';
import { toPlainText } from '../core/export-text';
import { DEFAULT_SETTINGS, normalizeSettings, type ArtResult, type CardField, type Settings } from '../core/types';
import { createCreation, openCreation, updateCreation, type CreationContent } from '../storage/creations';
import type { CreationRecord, ImagesRecord } from '../storage/db';
import { removeBackground, type BgProgress } from './lib/bg-removal-client';
import { ConversionClient } from './lib/convert-client';
import { ImageInputError, checkFile, decodeToRaw, prepareImage } from './lib/image-io';
import type { Confirm } from './components/ConfirmDialog';
import type { Notify } from './components/Toasts';

interface StudioImage {
  working: Blob;
  thumbnail: Blob;
  cutout: Blob | null;
}

export interface StudioState {
  image: StudioImage | null;
  settings: Settings;
  cardFields: CardField[];
  art: ArtResult | null;
  openId: string | null;
  openName: string | null;
  dirty: boolean;
}

type Action =
  | { type: 'imageLoaded'; working: Blob; thumbnail: Blob }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'cardFields'; fields: CardField[] }
  | { type: 'cutout'; cutout: Blob }
  | { type: 'art'; art: ArtResult }
  | { type: 'opened'; creation: CreationRecord; images: ImagesRecord }
  | { type: 'saved'; id: string; name: string }
  | { type: 'renamed'; name: string }
  | { type: 'detached' };

const initialState: StudioState = {
  image: null,
  settings: { ...DEFAULT_SETTINGS },
  cardFields: defaultCardFields(),
  art: null,
  openId: null,
  openName: null,
  dirty: false,
};

function reducer(state: StudioState, action: Action): StudioState {
  switch (action.type) {
    case 'imageLoaded':
      return {
        ...state,
        image: { working: action.working, thumbnail: action.thumbnail, cutout: null },
        // O recorte é da imagem anterior: não faz sentido na nova.
        settings: { ...state.settings, removeBackground: false, crop: null },
        art: null,
        openId: null,
        openName: null,
        dirty: true,
      };
    case 'settings':
      return { ...state, settings: { ...state.settings, ...action.patch }, dirty: true };
    case 'cardFields':
      return { ...state, cardFields: action.fields, dirty: true };
    case 'cutout':
      if (!state.image) return state;
      return {
        ...state,
        image: { ...state.image, cutout: action.cutout },
        settings: { ...state.settings, removeBackground: true },
        dirty: true,
      };
    case 'art':
      return { ...state, art: action.art };
    case 'opened':
      return {
        image: { working: action.images.working, thumbnail: action.creation.thumbnail, cutout: action.images.cutout },
        settings: {
          ...normalizeSettings(action.creation.settings),
          removeBackground: action.creation.settings.removeBackground && action.images.cutout !== null,
        },
        cardFields: action.creation.cardFields.length ? action.creation.cardFields : defaultCardFields(),
        art: null,
        openId: action.creation.id,
        openName: action.creation.name,
        dirty: false,
      };
    case 'saved':
      return { ...state, openId: action.id, openName: action.name, dirty: false };
    case 'renamed':
      return { ...state, openName: action.name };
    case 'detached':
      return { ...state, openId: null, openName: null, dirty: true };
  }
}

const CONSENT_KEY = 'ascii-studio:bg-removal-consent';

function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberConsent(): void {
  try {
    localStorage.setItem(CONSENT_KEY, '1');
  } catch {
    // Sem armazenamento, o aviso só volta a aparecer na próxima ativação.
  }
}

const UNSAVED_CONFIRM = {
  title: 'Descartar alterações não salvas?',
  message: 'O trabalho atual ainda não foi salvo na galeria e será substituído.',
  confirmLabel: 'Descartar',
  danger: true,
};

export function useStudio(notify: Notify, confirm: Confirm) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [loading, setLoading] = useState(false);
  const [bg, setBg] = useState<{ running: boolean; progress: BgProgress | null }>({ running: false, progress: null });

  const stateRef = useRef(state);
  stateRef.current = state;
  // Muda a cada nova imagem, para descartar resultados de operações antigas.
  const imageToken = useRef(0);

  const clientRef = useRef<ConversionClient | null>(null);
  clientRef.current ??= new ConversionClient(
    (art) => dispatch({ type: 'art', art }),
    (message) => notify(`Erro na conversão: ${message}`, 'error'),
  );
  const client = clientRef.current;

  const { image, settings } = state;
  const hasCutout = Boolean(image?.cutout);
  useEffect(() => {
    if (!image) return;
    client.convert(settings.removeBackground && hasCutout ? 'cutout' : 'working', settings);
  }, [client, image?.working, hasCutout, settings]);

  const confirmDiscard = useCallback(async () => {
    const current = stateRef.current;
    return !(current.image && current.dirty) || confirm(UNSAVED_CONFIRM);
  }, [confirm]);

  const loadFile = useCallback(
    async (file: File) => {
      try {
        checkFile(file);
        if (!(await confirmDiscard())) return;
        const token = ++imageToken.current;
        setLoading(true);
        const prepared = await prepareImage(file);
        if (token !== imageToken.current) return;
        client.setImage('working', prepared.raw);
        dispatch({ type: 'imageLoaded', working: prepared.working, thumbnail: prepared.thumbnail });
        setBg({ running: false, progress: null });
      } catch (error) {
        notify(error instanceof ImageInputError ? error.message : 'Não foi possível abrir a imagem.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [client, confirmDiscard, notify],
  );

  /** Devolve true se a criação foi aberta. */
  const openById = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        if (!(await confirmDiscard())) return false;
        const token = ++imageToken.current;
        const { creation, images } = await openCreation(id);
        const [raw, cutoutRaw] = await Promise.all([
          decodeToRaw(images.working),
          images.cutout ? decodeToRaw(images.cutout) : null,
        ]);
        if (token !== imageToken.current) return false;
        client.setImage('working', raw);
        if (cutoutRaw) client.setImage('cutout', cutoutRaw);
        dispatch({ type: 'opened', creation, images });
        setBg({ running: false, progress: null });
        return true;
      } catch (error) {
        notify(error instanceof Error && error.message ? error.message : 'Não foi possível abrir a criação.', 'error');
        return false;
      }
    },
    [client, confirmDiscard, notify],
  );

  const setSettings = useCallback((patch: Partial<Settings>) => dispatch({ type: 'settings', patch }), []);
  const setCardFields = useCallback((fields: CardField[]) => dispatch({ type: 'cardFields', fields }), []);

  const setBackgroundRemoval = useCallback(
    async (enabled: boolean) => {
      const current = stateRef.current.image;
      if (!enabled || !current) {
        dispatch({ type: 'settings', patch: { removeBackground: false } });
        return;
      }
      if (current.cutout) {
        dispatch({ type: 'settings', patch: { removeBackground: true } });
        return;
      }
      if (!hasConsent()) {
        const accepted = await confirm({
          title: 'Baixar a remoção de fundo?',
          message:
            'Na primeira vez, o navegador baixa cerca de 54 MB de arquivos do CDN da IMG.LY e os guarda em cache. Sua imagem é processada aqui e não sai do dispositivo.',
          confirmLabel: 'Baixar e remover',
        });
        if (!accepted) return;
        rememberConsent();
      }
      const token = imageToken.current;
      setBg({ running: true, progress: null });
      try {
        const cutout = await removeBackground(current.working, (progress) => {
          if (token === imageToken.current) setBg({ running: true, progress });
        });
        if (token !== imageToken.current) return;
        client.setImage('cutout', await decodeToRaw(cutout));
        dispatch({ type: 'cutout', cutout });
      } catch {
        if (token === imageToken.current) {
          notify('Não foi possível remover o fundo. Verifique sua conexão e tente de novo. A arte continua disponível.', 'error');
        }
      } finally {
        if (token === imageToken.current) setBg({ running: false, progress: null });
      }
    },
    [client, confirm, notify],
  );

  const contentToSave = (): CreationContent | null => {
    const { image: img, art, settings: s, cardFields } = stateRef.current;
    if (!img || !art) return null;
    return { art: toPlainText(art), thumbnail: img.thumbnail, working: img.working, cutout: img.cutout, settings: s, cardFields };
  };

  /** Salva como nova criação. Erros seguem para quem chamou, que os mostra no diálogo. */
  const saveAsNew = useCallback(async (name: string) => {
    const content = contentToSave();
    if (!content) return;
    const record = await createCreation(name, content);
    dispatch({ type: 'saved', id: record.id, name: record.name });
    notify(`"${record.name}" salva na galeria.`);
  }, [notify]);

  const saveExisting = useCallback(async () => {
    const { openId } = stateRef.current;
    const content = contentToSave();
    if (!openId || !content) return;
    try {
      const record = await updateCreation(openId, content);
      dispatch({ type: 'saved', id: record.id, name: record.name });
      notify(`"${record.name}" atualizada.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível salvar.', 'error');
    }
  }, [notify]);

  const onCreationRenamed = useCallback((id: string, name: string) => {
    if (stateRef.current.openId === id) dispatch({ type: 'renamed', name });
  }, []);

  const onCreationDeleted = useCallback((id: string) => {
    if (stateRef.current.openId === id) dispatch({ type: 'detached' });
  }, []);

  return {
    state,
    loading,
    bg,
    loadFile,
    openById,
    setSettings,
    setCardFields,
    setBackgroundRemoval,
    saveAsNew,
    saveExisting,
    onCreationRenamed,
    onCreationDeleted,
  };
}
