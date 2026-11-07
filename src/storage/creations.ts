import { validateName, type CardField, type Settings } from '../core/types';
import { db, type CreationRecord, type ImagesRecord } from './db';

/** Erro com mensagem pronta para mostrar à pessoa. */
export class StorageError extends Error {}

export function toStorageError(error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  const name = error instanceof Error ? error.name : '';
  const inner = (error as { inner?: { name?: string } } | null)?.inner?.name;
  if (name === 'QuotaExceededError' || inner === 'QuotaExceededError') {
    return new StorageError('Sem espaço de armazenamento no navegador. Exclua criações ou libere espaço e tente de novo. Nada foi salvo.');
  }
  return new StorageError('Não foi possível acessar o armazenamento do navegador. A conversão e a exportação continuam funcionando.');
}

async function guarded<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw toStorageError(error);
  }
}

function requireName(input: string): string {
  const result = validateName(input);
  if (!result.ok) throw new StorageError(result.error);
  return result.name;
}

export interface CreationContent {
  art: string;
  thumbnail: Blob;
  working: Blob;
  cutout: Blob | null;
  settings: Settings;
  cardFields: CardField[];
}

export async function createCreation(name: string, content: CreationContent): Promise<CreationRecord> {
  const validName = requireName(name);
  return guarded(async () => {
    const now = Date.now();
    const { working, cutout, ...rest } = content;
    const record: CreationRecord = { ...rest, id: crypto.randomUUID(), name: validName, createdAt: now, updatedAt: now };
    await db.transaction('rw', db.creations, db.images, async () => {
      await db.creations.add(record);
      await db.images.add({ id: record.id, working, cutout });
    });
    return record;
  });
}

export function updateCreation(id: string, content: CreationContent): Promise<CreationRecord> {
  return guarded(async () => {
    const { working, cutout, ...rest } = content;
    return db.transaction('rw', db.creations, db.images, async () => {
      const current = await db.creations.get(id);
      if (!current) throw new StorageError('Esta criação não existe mais. Use "Salvar como nova".');
      const record: CreationRecord = { ...current, ...rest, updatedAt: Date.now() };
      await db.creations.put(record);
      await db.images.put({ id, working, cutout });
      return record;
    });
  });
}

export type SortOrder = 'newest' | 'oldest';

const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function listCreations(query = '', order: SortOrder = 'newest'): Promise<CreationRecord[]> {
  return guarded(async () => {
    const term = normalize(query.trim());
    const all = await db.creations.orderBy('updatedAt').toArray();
    const found = term ? all.filter((c) => normalize(c.name).includes(term)) : all;
    return order === 'newest' ? found.reverse() : found;
  });
}

export async function renameCreation(id: string, name: string): Promise<void> {
  const validName = requireName(name);
  return guarded(async () => {
    await db.creations.update(id, { name: validName, updatedAt: Date.now() });
  });
}

export function duplicateCreation(id: string): Promise<CreationRecord> {
  return guarded(async () =>
    db.transaction('rw', db.creations, db.images, async () => {
      const [creation, images] = await Promise.all([db.creations.get(id), db.images.get(id)]);
      if (!creation || !images) throw new StorageError('Esta criação não existe mais.');
      const now = Date.now();
      const copyName = `${creation.name.slice(0, 92)} (cópia)`;
      const copy: CreationRecord = { ...creation, id: crypto.randomUUID(), name: copyName, createdAt: now, updatedAt: now };
      await db.creations.add(copy);
      await db.images.add({ ...images, id: copy.id });
      return copy;
    }),
  );
}

export function deleteCreation(id: string): Promise<void> {
  return guarded(async () => {
    await db.transaction('rw', db.creations, db.images, async () => {
      await db.creations.delete(id);
      await db.images.delete(id);
    });
  });
}

export function openCreation(id: string): Promise<{ creation: CreationRecord; images: ImagesRecord }> {
  return guarded(async () => {
    const [creation, images] = await Promise.all([db.creations.get(id), db.images.get(id)]);
    if (!creation || !images) throw new StorageError('Esta criação não existe mais.');
    return { creation, images };
  });
}
