import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/core/types';
import {
  StorageError,
  createCreation,
  deleteCreation,
  duplicateCreation,
  listCreations,
  openCreation,
  renameCreation,
  updateCreation,
  type CreationContent,
} from '../../src/storage/creations';
import { db } from '../../src/storage/db';

const content = (patch: Partial<CreationContent> = {}): CreationContent => ({
  art: 'abc',
  thumbnail: new Blob(['t'], { type: 'image/webp' }),
  working: new Blob(['w'], { type: 'image/png' }),
  cutout: null,
  settings: { ...DEFAULT_SETTINGS, width: 77, brightness: 12 },
  cardFields: [{ id: '1', label: 'Nome', value: 'Ana' }],
  ...patch,
});

beforeEach(async () => {
  await db.creations.clear();
  await db.images.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(1000);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('salvar e abrir', () => {
  it('guarda tudo e reabre igual', async () => {
    const saved = await createCreation('  Meu rosto  ', content({ cutout: new Blob(['c'], { type: 'image/png' }) }));
    expect(saved.name).toBe('Meu rosto');
    const { creation, images } = await openCreation(saved.id);
    expect(creation).toMatchObject({ art: 'abc', createdAt: 1000, updatedAt: 1000, name: 'Meu rosto' });
    expect(creation.settings).toEqual(content().settings);
    expect(creation.cardFields).toEqual(content().cardFields);
    expect(await images.working.text()).toBe('w');
    expect(await images.cutout!.text()).toBe('c');
  });

  it.each(['', '   ', 'x'.repeat(101)])('recusa nome inválido %j', async (name) => {
    await expect(createCreation(name, content()).catch((e) => e)).resolves.toBeInstanceOf(StorageError);
    await expect(listCreations()).resolves.toEqual([]);
  });

  it('permite nomes repetidos', async () => {
    await createCreation('A', content());
    await createCreation('A', content());
    await expect(listCreations()).resolves.toHaveLength(2);
  });

  it('abrir o que não existe gera erro legível', async () => {
    await expect(openCreation('nada')).rejects.toThrow(/não existe/);
  });

  it('atualizar preserva a criação e muda o conteúdo e a data', async () => {
    const saved = await createCreation('A', content());
    vi.setSystemTime(2000);
    await updateCreation(saved.id, content({ art: 'novo', working: new Blob(['w2'], { type: 'image/png' }) }));
    const { creation, images } = await openCreation(saved.id);
    expect(creation).toMatchObject({ art: 'novo', name: 'A', createdAt: 1000, updatedAt: 2000 });
    expect(await images.working.text()).toBe('w2');
  });

  it('atualizar uma criação excluída avisa', async () => {
    await expect(updateCreation('nada', content())).rejects.toThrow(/Salvar como nova/);
  });

  it('falha de quota mostra mensagem e não salva nada parcial', async () => {
    vi.spyOn(db.images, 'add').mockRejectedValue(Object.assign(new Error('x'), { name: 'QuotaExceededError' }));
    await expect(createCreation('A', content())).rejects.toThrow(/espaço/);
    await expect(db.creations.count()).resolves.toBe(0);
  });
});

describe('listar', () => {
  beforeEach(async () => {
    await createCreation('Rosto', content());
    vi.setSystemTime(2000);
    await createCreation('Paisagem', content());
    vi.setSystemTime(3000);
    await createCreation('Coração', content());
  });

  it('ordena pela data de atualização', async () => {
    expect((await listCreations()).map((c) => c.name)).toEqual(['Coração', 'Paisagem', 'Rosto']);
    expect((await listCreations('', 'oldest')).map((c) => c.name)).toEqual(['Rosto', 'Paisagem', 'Coração']);
  });

  it('busca sem diferenciar maiúsculas e acentos', async () => {
    expect((await listCreations('ROS')).map((c) => c.name)).toEqual(['Rosto']);
    expect((await listCreations('coracao')).map((c) => c.name)).toEqual(['Coração']);
    await expect(listCreations('zzz')).resolves.toEqual([]);
  });
});

describe('renomear, duplicar e excluir', () => {
  it('renomeia validando o nome', async () => {
    const { id } = await createCreation('A', content());
    await renameCreation(id, ' B ');
    expect((await openCreation(id)).creation.name).toBe('B');
    await expect(renameCreation(id, ' ')).rejects.toBeInstanceOf(StorageError);
    expect((await openCreation(id)).creation.name).toBe('B');
  });

  it('duplica sem alterar a original', async () => {
    const { id } = await createCreation('A', content());
    const copy = await duplicateCreation(id);
    expect(copy.id).not.toBe(id);
    expect(copy.name).toBe('A (cópia)');
    expect(await (await openCreation(copy.id)).images.working.text()).toBe('w');
    expect((await openCreation(id)).creation.name).toBe('A');
  });

  it('o nome da cópia respeita o limite', async () => {
    const { id } = await createCreation('x'.repeat(100), content());
    expect((await duplicateCreation(id)).name.length).toBeLessThanOrEqual(100);
  });

  it('excluir remove das duas tabelas', async () => {
    const { id } = await createCreation('A', content());
    await deleteCreation(id);
    await expect(db.creations.count()).resolves.toBe(0);
    await expect(db.images.count()).resolves.toBe(0);
  });
});
