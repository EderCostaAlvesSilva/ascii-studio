import Dexie, { type EntityTable } from 'dexie';
import type { CardField, Settings } from '../core/types';

export interface CreationRecord {
  id: string;
  name: string;
  art: string;
  thumbnail: Blob;
  settings: Settings;
  cardFields: CardField[];
  createdAt: number;
  updatedAt: number;
}

/** Cópias pesadas ficam à parte, para a galeria listar sem carregá-las. */
export interface ImagesRecord {
  id: string;
  working: Blob;
  cutout: Blob | null;
}

export const db = new Dexie('ascii-studio') as Dexie & {
  creations: EntityTable<CreationRecord, 'id'>;
  images: EntityTable<ImagesRecord, 'id'>;
};

db.version(1).stores({
  creations: 'id, name, createdAt, updatedAt',
  images: 'id',
});
