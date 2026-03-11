const IDB_NAME = "ytf-ml-cache";
const IDB_STORE = "inferences";
const IDB_VERSION = 3;
const IDB_MAX_ENTRIES = 5000;

let idb: IDBDatabase | null = null;

export function hashTitle(title: string): string {
  let h = 5381;
  for (let i = 0; i < title.length; i++) {
    h = ((h << 5) + h + title.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

export async function openIDB(): Promise<IDBDatabase | null> {
  if (idb) return idb;
  return new Promise((resolve) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (db.objectStoreNames.contains(IDB_STORE))
        db.deleteObjectStore(IDB_STORE);
      const store = db.createObjectStore(IDB_STORE, { keyPath: "hash" });
      store.createIndex("ts", "ts");
    };
    req.onsuccess = () => {
      idb = req.result;
      resolve(idb);
    };
    req.onerror = () => resolve(null);
  });
}

export async function getCachedResult(title: string): Promise<unknown> {
  const db = await openIDB();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(hashTitle(title));
      req.onsuccess = () => resolve(req.result?.data);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export async function setCachedResult(
  title: string,
  data: unknown,
): Promise<void> {
  const db = await openIDB();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put({
      hash: hashTitle(title),
      data,
      ts: Date.now(),
    });
  } catch {
    /* ignore */
  }
}

export async function trimIDBCache(): Promise<void> {
  const db = await openIDB();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result > IDB_MAX_ENTRIES) {
        const toDelete = Math.floor(countReq.result * 0.2);
        const cursor = store.index("ts").openCursor();
        let deleted = 0;
        cursor.onsuccess = (e) => {
          const c = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (c && deleted < toDelete) {
            c.delete();
            deleted++;
            c.continue();
          }
        };
      }
    };
  } catch {
    /* ignore */
  }
}
