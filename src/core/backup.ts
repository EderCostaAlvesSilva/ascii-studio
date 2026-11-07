import { validateCustomRamp } from './ramps';
import { LIMITS, normalizeSettings, validateName, widthLimits, type CardField, type RampId, type Settings } from './types';

export const BACKUP_FORMAT = 'ascii-studio-backup';
export const BACKUP_VERSION = 1;

/** Criação como aparece no arquivo: imagens em data URL. */
export interface BackupCreation {
  id: string;
  name: string;
  art: string;
  settings: Settings;
  cardFields: CardField[];
  createdAt: number;
  updatedAt: number;
  thumbnail: string;
  working: string;
  cutout: string | null;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  creations: BackupCreation[];
}

const DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]*={0,2}$/;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isTime = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const inRange = (v: unknown, { min, max }: { min: number; max: number }) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isImage = (v: unknown) => typeof v === 'string' && DATA_URL.test(v);

function isCrop(v: unknown): boolean {
  if (!isObject(v)) return false;
  const { x, y, width, height } = v;
  if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') return false;
  // Tolera o arredondamento da soma de frações.
  return x >= 0 && y >= 0 && width >= LIMITS.minCrop && height >= LIMITS.minCrop && x + width <= 1.001 && y + height <= 1.001;
}

function isSettings(v: unknown): v is Settings {
  if (!isObject(v)) return false;
  if (typeof v.customRamp !== 'string') return false;
  if (v.rampId === 'custom') {
    if (!validateCustomRamp(v.customRamp).ok) return false;
  } else if (v.rampId !== 'simple' && v.rampId !== 'detailed' && v.rampId !== 'blocks' && v.rampId !== 'emoji') {
    return false;
  }
  return (
    inRange(v.width, widthLimits(v.rampId as RampId)) &&
    inRange(v.brightness, LIMITS.brightness) &&
    inRange(v.contrast, LIMITS.contrast) &&
    inRange(v.sharpness, LIMITS.sharpness) &&
    (v.autoContrast === undefined || typeof v.autoContrast === 'boolean') &&
    (v.crop === undefined || v.crop === null || isCrop(v.crop)) &&
    (v.trimEdge === undefined || inRange(v.trimEdge, LIMITS.trimEdge)) &&
    typeof v.invert === 'boolean' &&
    typeof v.removeBackground === 'boolean' &&
    typeof v.color === 'boolean' &&
    (v.theme === 'dark' || v.theme === 'light')
  );
}

const isCardField = (v: unknown): v is CardField =>
  isObject(v) && typeof v.id === 'string' && typeof v.label === 'string' && typeof v.value === 'string';

function isCreation(v: unknown): v is BackupCreation {
  return (
    isObject(v) &&
    typeof v.id === 'string' &&
    v.id.length > 0 &&
    typeof v.name === 'string' &&
    validateName(v.name).ok &&
    typeof v.art === 'string' &&
    isSettings(v.settings) &&
    Array.isArray(v.cardFields) &&
    v.cardFields.every(isCardField) &&
    isTime(v.createdAt) &&
    isTime(v.updatedAt) &&
    isImage(v.thumbnail) &&
    isImage(v.working) &&
    (v.cutout === null || isImage(v.cutout))
  );
}

export function parseBackup(json: string): { ok: true; backup: BackupFile } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: 'O arquivo não é um JSON válido.' };
  }
  if (!isObject(data) || data.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'Este arquivo não é um backup do ASCII Studio.' };
  }
  if (typeof data.version !== 'number') return { ok: false, error: 'O backup não informa a versão do formato.' };
  if (data.version > BACKUP_VERSION) {
    return { ok: false, error: 'Este backup foi criado por uma versão mais nova. Atualize o aplicativo e tente de novo.' };
  }
  if (!Array.isArray(data.creations)) return { ok: false, error: 'O backup não contém uma lista de criações.' };
  const invalid = data.creations.findIndex((c) => !isCreation(c));
  if (invalid >= 0) return { ok: false, error: `A criação ${invalid + 1} do backup está incompleta ou corrompida.` };
  const backup = data as unknown as BackupFile;
  return {
    ok: true,
    backup: { ...backup, creations: backup.creations.map((c) => ({ ...c, settings: normalizeSettings(c.settings) })) },
  };
}

/** Representação independente da ordem das chaves, para comparar conteúdos. */
function fingerprint(c: BackupCreation): string {
  const { settings: s } = c;
  return JSON.stringify([
    c.name,
    c.art,
    [s.width, s.rampId, s.customRamp, s.invert, s.brightness, s.contrast, s.sharpness, s.autoContrast, s.crop, s.trimEdge, s.removeBackground, s.color, s.theme],
    c.cardFields.map((f) => [f.id, f.label, f.value]),
    c.createdAt,
    c.updatedAt,
    c.thumbnail,
    c.working,
    c.cutout,
  ]);
}

/** Mescla sem sobrescrever: idênticas são ignoradas; conflitos de id entram como cópia. */
export function planImport(
  incoming: BackupCreation[],
  existing: BackupCreation[],
  newId: () => string,
): { toAdd: BackupCreation[]; skipped: number; copied: number } {
  const known = new Map(existing.map((c) => [c.id, new Set([fingerprint(c)])]));
  const toAdd: BackupCreation[] = [];
  let skipped = 0;
  let copied = 0;

  for (const creation of incoming) {
    const print = fingerprint(creation);
    const prints = known.get(creation.id);
    if (!prints) {
      known.set(creation.id, new Set([print]));
      toAdd.push(creation);
    } else if (prints.has(print)) {
      skipped++;
    } else {
      prints.add(print);
      toAdd.push({ ...creation, id: newId() });
      copied++;
    }
  }
  return { toAdd, skipped, copied };
}
