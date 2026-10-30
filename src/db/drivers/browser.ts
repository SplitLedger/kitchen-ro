import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm-browser.wasm?url";
import type { SqlExecutor } from "../executor";
import { createSqlJsExecutor } from "./sqljs";

const databaseName = "kitchen-ro";
const storeName = "sqlite";
const recordKey = "main";

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      reject(request.error ?? new Error("Could not open the browser database."));
    };
  });
}

async function readDatabaseBytes(): Promise<Uint8Array | null> {
  const database = await openIndexedDb();
  try {
    const stored = await new Promise<unknown>((resolve, reject) => {
      const request = database
        .transaction(storeName, "readonly")
        .objectStore(storeName)
        .get(recordKey);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        reject(request.error ?? new Error("Could not read the browser database."));
      };
    });
    if (stored instanceof Uint8Array) {
      return stored;
    }
    if (stored instanceof ArrayBuffer) {
      return new Uint8Array(stored);
    }
    return null;
  } finally {
    database.close();
  }
}

async function writeDatabaseBytes(bytes: Uint8Array): Promise<void> {
  const database = await openIndexedDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      const request = transaction.objectStore(storeName).put(bytes, recordKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        reject(transaction.error ?? new Error("Could not save the browser database."));
      };
      transaction.onabort = () => {
        reject(transaction.error ?? new Error("Could not save the browser database."));
      };
      request.onerror = () => {
        reject(request.error ?? new Error("Could not save the browser database."));
      };
    });
  } finally {
    database.close();
  }
}

export async function createBrowserExecutor(): Promise<SqlExecutor> {
  const SQL = await initSqlJs({
    locateFile: () => wasmUrl,
  });
  const saved = await readDatabaseBytes();
  const database = saved ? new SQL.Database(saved) : new SQL.Database();

  return createSqlJsExecutor(database, {
    persist: async () => {
      await writeDatabaseBytes(database.export());
    },
  });
}
