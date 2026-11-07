import { BACKUP_FORMAT, BACKUP_VERSION, parseBackup, planImport, type BackupCreation } from '../core/backup';
import { StorageError, toStorageError } from './creations';
import { db, type CreationRecord, type ImagesRecord } from './db';

const CHUNK = 0x8000;

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${blob.type || 'image/png'};base64,${btoa(binary)}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const type = dataUrl.slice(5, dataUrl.indexOf(';'));
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

async function toBackupCreation(creation: CreationRecord, images: ImagesRecord): Promise<BackupCreation> {
  const { thumbnail, ...rest } = creation;
  return {
    ...rest,
    thumbnail: await blobToDataUrl(thumbnail),
    working: await blobToDataUrl(images.working),
    cutout: images.cutout ? await blobToDataUrl(images.cutout) : null,
  };
}

/** Monta o arquivo em partes, para não criar uma única string gigante. */
export async function exportBackup(): Promise<{ blob: Blob; count: number }> {
  try {
    const ids = (await db.creations.toCollection().primaryKeys()) as string[];
    const parts: string[] = [
      `{"format":${JSON.stringify(BACKUP_FORMAT)},"version":${BACKUP_VERSION},"exportedAt":${Date.now()},"creations":[`,
    ];
    for (const [index, id] of ids.entries()) {
      const [creation, images] = await Promise.all([db.creations.get(id), db.images.get(id)]);
      if (!creation || !images) continue;
      parts.push((index > 0 ? ',' : '') + JSON.stringify(await toBackupCreation(creation, images)));
    }
    parts.push(']}');
    return { blob: new Blob(parts, { type: 'application/json' }), count: ids.length };
  } catch (error) {
    throw toStorageError(error);
  }
}

export interface ImportSummary {
  added: number;
  skipped: number;
  copied: number;
}

/** Importa em uma única transação: se algo falhar, a galeria fica como estava. */
export async function importBackup(json: string): Promise<ImportSummary> {
  const parsed = parseBackup(json);
  if (!parsed.ok) throw new StorageError(parsed.error);
  const incoming = parsed.backup.creations;

  try {
    // Ler os Blobs é assíncrono e encerraria a transação, por isso a comparação vem antes dela.
    const ids = [...new Set(incoming.map((c) => c.id))];
    const [creations, images] = await Promise.all([db.creations.bulkGet(ids), db.images.bulkGet(ids)]);
    const existing: BackupCreation[] = [];
    for (const [i, creation] of creations.entries()) {
      const image = images[i];
      if (creation && image) existing.push(await toBackupCreation(creation, image));
    }
    const plan = planImport(incoming, existing, () => crypto.randomUUID());

    await db.transaction('rw', db.creations, db.images, async () => {
      await db.creations.bulkAdd(
        plan.toAdd.map(({ working: _working, cutout: _cutout, thumbnail, ...rest }) => ({
          ...rest,
          thumbnail: dataUrlToBlob(thumbnail),
        })),
      );
      await db.images.bulkAdd(
        plan.toAdd.map((c) => ({
          id: c.id,
          working: dataUrlToBlob(c.working),
          cutout: c.cutout ? dataUrlToBlob(c.cutout) : null,
        })),
      );
    });
    return { added: plan.toAdd.length - plan.copied, skipped: plan.skipped, copied: plan.copied };
  } catch (error) {
    throw toStorageError(error);
  }
}

export async function importBackupFile(file: Blob): Promise<ImportSummary> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new StorageError('O arquivo é grande demais para o navegador ler. A galeria não foi alterada.');
  }
  return importBackup(text);
}
