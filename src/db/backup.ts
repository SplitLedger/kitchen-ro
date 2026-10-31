import initSqlJs, { type SqlJsDatabase } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm-browser.wasm?url";
import { isTauriRuntime } from "./runtime";

const sqliteHeader = "SQLite format 3\u0000";
const maxBackupBytes = 64 * 1024 * 1024;
const restoreErrorKey = "kitchen-ro-restore-error";
const requiredTables = ["settings", "ingredients", "cooking_kits", "recipes", "orders"] as const;

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}

export function assertSqliteHeader(bytes: Uint8Array): void {
  if (bytes.length > maxBackupBytes) {
    throw new BackupError("That file is too large to restore.");
  }
  const header = new TextDecoder().decode(bytes.subarray(0, Math.min(16, bytes.length)));
  if (header !== sqliteHeader) {
    throw new BackupError("That file is not a SQLite database.");
  }
}

export function assertKitchenSchema(database: SqlJsDatabase): void {
  const missing = requiredTables.filter((table) => !hasTable(database, table));
  if (missing.length > 0) {
    throw new BackupError("That file is not a Kitchen RO database.");
  }
}

export async function assertKitchenBackup(bytes: Uint8Array): Promise<void> {
  assertSqliteHeader(bytes);
  const SQL = await initSqlJs({
    locateFile: () => wasmUrl,
  });
  let database: SqlJsDatabase | null = null;
  try {
    database = new SQL.Database(bytes);
    assertKitchenSchema(database);
  } catch (error) {
    if (error instanceof BackupError) {
      throw error;
    }
    throw new BackupError("That file could not be opened as a Kitchen RO database.");
  } finally {
    database?.close();
  }
}

export function takeRestoreError(): string | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  const message = sessionStorage.getItem(restoreErrorKey);
  if (message) {
    sessionStorage.removeItem(restoreErrorKey);
  }
  return message;
}

export async function saveDatabaseBackup(): Promise<"saved" | "cancelled"> {
  if (isTauriRuntime()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return (await invoke<boolean>("save_database_backup")) ? "saved" : "cancelled";
  }
  const { exportBrowserDatabaseBytes } = await import("./drivers/browser");
  const bytes = exportBrowserDatabaseBytes();
  assertSqliteHeader(bytes);
  downloadBytes(bytes, "kitchen-ro.db");
  return "saved";
}

export async function readChosenBackup(file: File): Promise<Uint8Array> {
  if (file.size > maxBackupBytes) {
    throw new BackupError("That file is too large to restore.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  await assertKitchenBackup(bytes);
  return bytes;
}

export async function pickTauriBackup(): Promise<Uint8Array | null> {
  const { invoke } = await import("@tauri-apps/api/core");
  const payload = await invoke<number[] | null>("pick_database_backup");
  if (payload === null) {
    return null;
  }
  const bytes = new Uint8Array(payload);
  await assertKitchenBackup(bytes);
  return bytes;
}

export async function installDatabaseBackup(bytes: Uint8Array): Promise<void> {
  await assertKitchenBackup(bytes);
  if (isTauriRuntime()) {
    const { closeTauriDatabase } = await import("./drivers/tauri");
    const { invoke } = await import("@tauri-apps/api/core");
    await closeTauriDatabase();
    try {
      await invoke("install_database_backup", { bytes: Array.from(bytes) });
    } catch (error) {
      rememberRestoreError(errorMessage(error));
      window.location.reload();
      return;
    }
    window.location.reload();
    return;
  }
  const { replaceBrowserDatabase } = await import("./drivers/browser");
  await replaceBrowserDatabase(bytes);
  window.location.reload();
}

function hasTable(database: SqlJsDatabase, name: string): boolean {
  const statement = database.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
  );
  try {
    statement.bind([name]);
    return statement.step();
  } finally {
    statement.free();
  }
}

function downloadBytes(bytes: Uint8Array, filename: string): void {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "application/vnd.sqlite3" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function rememberRestoreError(message: string): void {
  sessionStorage.setItem(restoreErrorKey, message);
}

function errorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Could not restore that backup. The previous database is still in use.";
}
