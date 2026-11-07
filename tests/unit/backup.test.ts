import { describe, expect, it } from 'vitest';
import { parseBackup, planImport, type BackupCreation, BACKUP_FORMAT } from '../../src/core/backup';
import { DEFAULT_SETTINGS } from '../../src/core/types';

const creation = (patch: Partial<BackupCreation> = {}): BackupCreation => ({
  id: 'a',
  name: 'Arte',
  art: 'x',
  settings: { ...DEFAULT_SETTINGS },
  cardFields: [],
  createdAt: 1,
  updatedAt: 2,
  thumbnail: 'data:image/webp;base64,AAAA',
  working: 'data:image/png;base64,AAAA',
  cutout: null,
  ...patch,
});

const file = (creations: unknown[], patch: object = {}) =>
  JSON.stringify({ format: BACKUP_FORMAT, version: 1, exportedAt: 1, creations, ...patch });

describe('parseBackup', () => {
  it('aceita arquivo válido', () => {
    const r = parseBackup(file([creation()]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.backup.creations).toHaveLength(1);
  });

  it.each([
    ['JSON inválido', '{nada'],
    ['formato errado', JSON.stringify({ format: 'outro', version: 1, creations: [] })],
    ['sem lista', JSON.stringify({ format: BACKUP_FORMAT, version: 1 })],
    ['raiz não objeto', '[]'],
    ['campo ausente', file([{ ...creation(), name: undefined }])],
    ['nome vazio', file([creation({ name: '   ' })])],
    ['largura fora do limite', file([creation({ settings: { ...DEFAULT_SETTINGS, width: 500 } })])],
    ['brilho de tipo errado', file([creation({ settings: { ...DEFAULT_SETTINGS, brightness: 'a' as unknown as number } })])],
    ['conjunto desconhecido', file([creation({ settings: { ...DEFAULT_SETTINGS, rampId: 'x' as 'simple' } })])],
    ['personalizado inválido', file([creation({ settings: { ...DEFAULT_SETTINGS, rampId: 'custom', customRamp: '' } })])],
    ['imagem SVG', file([creation({ working: 'data:image/svg+xml;base64,AAAA' })])],
    ['imagem que não é data URL', file([creation({ thumbnail: 'https://exemplo.com/a.png' })])],
    ['recorte de tipo errado', file([creation({ cutout: 5 as unknown as string })])],
    ['campo de cartão inválido', file([creation({ cardFields: [{ id: 1 }] as unknown as [] })])],
    ['data inválida', file([creation({ createdAt: 'ontem' as unknown as number })])],
  ])('recusa %s', (_nome, json) => {
    const r = parseBackup(json);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });

  it('pede atualização quando a versão é futura', () => {
    const r = parseBackup(file([], { version: 2 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/atualiz/i);
  });
});

describe('planImport', () => {
  const ids = () => {
    let n = 0;
    return () => `novo-${++n}`;
  };

  it('adiciona as que não existem', () => {
    const plan = planImport([creation()], [], ids());
    expect(plan).toMatchObject({ skipped: 0, copied: 0 });
    expect(plan.toAdd.map((c) => c.id)).toEqual(['a']);
  });

  it('ignora as idênticas', () => {
    const plan = planImport([creation()], [creation()], ids());
    expect(plan.toAdd).toEqual([]);
    expect(plan.skipped).toBe(1);
  });

  it('a ordem das chaves não torna duas criações diferentes', () => {
    const { id, ...rest } = creation();
    const plan = planImport([{ ...rest, id } as BackupCreation], [creation()], ids());
    expect(plan.skipped).toBe(1);
  });

  it('importa conflitos como cópia, sem sobrescrever', () => {
    const plan = planImport([creation({ art: 'y' })], [creation()], ids());
    expect(plan.copied).toBe(1);
    expect(plan.toAdd[0]).toMatchObject({ id: 'novo-1', art: 'y', name: 'Arte' });
  });

  it('trata repetições dentro do próprio arquivo', () => {
    const plan = planImport([creation(), creation(), creation({ art: 'y' })], [], ids());
    expect(plan.toAdd.map((c) => c.id)).toEqual(['a', 'novo-1']);
    expect(plan).toMatchObject({ skipped: 1, copied: 1 });
  });
});
