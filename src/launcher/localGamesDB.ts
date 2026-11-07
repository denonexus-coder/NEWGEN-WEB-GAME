/** Persistência offline de jogos importados (IndexedDB) — funciona sem internet */

const DB_NAME = 'newgen-launcher';
const DB_VERSION = 1;
const STORE = 'games';

export interface StoredGame {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  thumbnail?: string; // data-uri
  /** código-fonte ES module do jogo */
  code: string;
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB indisponível'));
  });
  return dbPromise;
}

function tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDB().then((db) => db.transaction(STORE, mode).objectStore(STORE));
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putGame(game: StoredGame): Promise<void> {
  const store = await tx('readwrite');
  await wrap(store.put(game));
}

export async function getAllGames(): Promise<StoredGame[]> {
  const store = await tx('readonly');
  const list = await wrap<StoredGame[]>(store.getAll());
  return list.sort((a, b) => b.savedAt - a.savedAt);
}

export async function getGame(id: string): Promise<StoredGame | undefined> {
  const store = await tx('readonly');
  return wrap<StoredGame | undefined>(store.get(id));
}

export async function deleteGame(id: string): Promise<void> {
  const store = await tx('readwrite');
  await wrap(store.delete(id));
}
