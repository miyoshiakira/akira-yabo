import { SaveData } from './saveData';

const DB_NAME = 'akira-yabo-db';
const DB_VERSION = 1;
const STORE_NAME = 'saveData';
const MAX_SLOTS = 3;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllSaveSlots(): Promise<(SaveData | null)[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const byId = new Map(
        (req.result as (ReturnType<SaveData['toJSON']>)[]).map((r) => [r.id, SaveData.fromJSON(r)]),
      );
      resolve(Array.from({ length: MAX_SLOTS }, (_, i) => byId.get(i + 1) ?? null));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getSaveSlot(id: number): Promise<SaveData | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result ? SaveData.fromJSON(req.result) : null);
    req.onerror = () => reject(req.error);
  });
}

export async function writeSaveSlot(save: SaveData): Promise<void> {
  save.updatedAt = new Date();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(save.toJSON());
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSaveSlot(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export interface NewSaveParams {
  year: number;
  month: number;
  soldiers: number;
  food: number;
  gold: number;
  security: number;
  population: number;
  homeProvinceId: string;
}

export async function createNewSave(
  id: number,
  daimyoId: string,
  playerName: string,
  params: NewSaveParams,
): Promise<SaveData> {
  const save = new SaveData({
    id,
    daimyoId,
    playerName,
    slotName: `スロット ${id}`,
    year: params.year,
    month: params.month,
    soldiers: params.soldiers,
    food: params.food,
    gold: params.gold,
    security: params.security,
    population: params.population,
    ownedProvinces: [params.homeProvinceId],
    retainerAssignments: {},
    playtimeSeconds: 0,
  });
  await writeSaveSlot(save);
  return save;
}
