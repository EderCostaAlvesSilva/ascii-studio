import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/core/types';
import { exportBackup, importBackup, importBackupFile } from '../../src/storage/backup-io';
import { createCreation, listCreations, openCreation, type CreationContent } from '../../src/storage/creations';
import { db } from '../../src/storage/db';

const content = (art = 'abc'): CreationContent => ({
  art,
  thumbnail: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }),
  working: new Blob([new Uint8Array([4, 5, 6, 255])], { type: 'image/png' }),
  cutout: new Blob([new Uint8Array([7, 8])], { type: 'image/png' }),
  settings: { ...DEFAULT_SETTINGS, contrast: 33 },
  cardFields: [{ id: '1', label: 'Nome', value: 'Ana' }],
});

const clear = async () => {
  await db.creations.clear();
  await db.images.clear();
};

beforeEach(clear);
afterEach(() => vi.restoreAllMocks());

const bytes = async (blob: Blob) => Array.from(new Uint8Array(await blob.arrayBuffer()));

describe('backup', () => {
  it('ida e volta restaura tudo em uma galeria limpa', async () => {
    const a = await createCreation('A', content('aaa'));
    await createCreation('B', content('bbb'));
    const { blob, count } = await exportBackup();
    expect(count).toBe(2);

    await clear();
    await expect(importBackup(await blob.text())).resolves.toEqual({ added: 2, skipped: 0, copied: 0 });

    const { creation, images } = await openCreation(a.id);
    expect(creation).toMatchObject({ name: 'A', art: 'aaa', createdAt: a.createdAt, updatedAt: a.updatedAt });
    expect(creation.settings.contrast).toBe(33);
    expect(await bytes(creation.thumbnail)).toEqual([1, 2, 3]);
    expect(creation.thumbnail.type).toBe('image/webp');
    expect(await bytes(images.working)).toEqual([4, 5, 6, 255]);
    expect(await bytes(images.cutout!)).toEqual([7, 8]);
  });

  it('galeria vazia gera um backup válido', async () => {
    const { blob, count } = await exportBackup();
    expect(count).toBe(0);
    await expect(importBackup(await blob.text())).resolves.toEqual({ added: 0, skipped: 0, copied: 0 });
  });

  it('reimportar o mesmo arquivo não duplica', async () => {
    await createCreation('A', content());
    const { blob } = await exportBackup();
    await expect(importBackup(await blob.text())).resolves.toEqual({ added: 0, skipped: 1, copied: 0 });
    await expect(listCreations()).resolves.toHaveLength(1);
  });

  it('conflito entra como cópia, sem sobrescrever', async () => {
    const a = await createCreation('A', content('original'));
    const text = await (await exportBackup()).blob.text();
    await db.creations.update(a.id, { art: 'editada' });
    await expect(importBackup(text)).resolves.toEqual({ added: 0, skipped: 0, copied: 1 });
    await expect(listCreations()).resolves.toHaveLength(2);
    expect((await openCreation(a.id)).creation.art).toBe('editada');
  });

  it('arquivo inválido não altera a galeria', async () => {
    await createCreation('A', content());
    await expect(importBackup('{nada')).rejects.toThrow(/JSON/);
    await expect(listCreations()).resolves.toHaveLength(1);
  });

  it('falha durante a escrita desfaz tudo', async () => {
    await createCreation('A', content());
    const text = await (await exportBackup()).blob.text();
    await clear();
    vi.spyOn(db.images, 'bulkAdd').mockRejectedValue(new Error('falha'));
    await expect(importBackup(text)).rejects.toThrow();
    await expect(db.creations.count()).resolves.toBe(0);
  });

  it('arquivo que não pode ser lido gera mensagem', async () => {
    const file = { text: () => Promise.reject(new Error('grande')) } as unknown as Blob;
    await expect(importBackupFile(file)).rejects.toThrow(/grande demais/);
  });
});
