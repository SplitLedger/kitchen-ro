use std::path::{Path, PathBuf};
use std::time::Duration;

use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::Sqlite;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

const MAX_BACKUP_BYTES: u64 = 64 * 1024 * 1024;
const SQLITE_HEADER: &[u8] = b"SQLite format 3\0";
const KITCHEN_TABLES: [&str; 5] = ["settings", "ingredients", "cooking_kits", "recipes", "orders"];

#[tauri::command]
pub async fn save_database_backup(app: tauri::AppHandle) -> Result<bool, String> {
    let window = app.get_webview_window("main");
    let mut dialog = app
        .dialog()
        .file()
        .set_title("Save Kitchen RO backup")
        .set_file_name("kitchen-ro.db")
        .add_filter("SQLite database", &["db"]);
    if let Some(window) = &window {
        dialog = dialog.set_parent(window);
    }
    let Some(picked) = dialog.blocking_save_file() else {
        return Ok(false);
    };
    let destination = picked
        .into_path()
        .map_err(|_| "Could not use that path.".to_string())?;
    let source = database_path(&app)?;
    if same_path(&source, &destination) {
        return Err("Choose a different file. That path is the live database.".into());
    }
    vacuum_into(&source, &destination).await?;
    Ok(true)
}

#[tauri::command]
pub async fn pick_database_backup(app: tauri::AppHandle) -> Result<Option<Vec<u8>>, String> {
    let window = app.get_webview_window("main");
    let mut dialog = app
        .dialog()
        .file()
        .set_title("Restore Kitchen RO backup")
        .add_filter("SQLite database", &["db"]);
    if let Some(window) = &window {
        dialog = dialog.set_parent(window);
    }
    let Some(picked) = dialog.blocking_pick_file() else {
        return Ok(None);
    };
    let source = picked
        .into_path()
        .map_err(|_| "Could not use that path.".to_string())?;
    Ok(Some(read_backup_file(&source)?))
}

#[tauri::command]
pub async fn install_database_backup(app: tauri::AppHandle, bytes: Vec<u8>) -> Result<(), String> {
    if bytes.len() as u64 > MAX_BACKUP_BYTES {
        return Err("That file is too large to restore.".into());
    }
    if !has_sqlite_header(&bytes) {
        return Err("That file is not a SQLite database.".into());
    }
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|_| "Could not find the app config folder.".to_string())?;
    std::fs::create_dir_all(&dir).map_err(|err| format!("Could not prepare the database folder: {err}"))?;
    let temporary = dir.join("kitchen-ro.restore.db");
    std::fs::write(&temporary, &bytes).map_err(|err| format!("Could not write the backup: {err}"))?;
    if let Err(err) = assert_kitchen_database(&temporary).await {
        let _ = std::fs::remove_file(&temporary);
        return Err(err);
    }
    let destination = dir.join("kitchen-ro.db");
    replace_database_file(&temporary, &destination)
}

fn read_backup_file(path: &Path) -> Result<Vec<u8>, String> {
    let metadata = std::fs::metadata(path).map_err(|_| "Could not read that file.".to_string())?;
    if !metadata.is_file() {
        return Err("Choose a database file.".into());
    }
    if metadata.len() > MAX_BACKUP_BYTES {
        return Err("That file is too large to restore.".into());
    }
    let bytes = std::fs::read(path).map_err(|_| "Could not read that file.".to_string())?;
    if !has_sqlite_header(&bytes) {
        return Err("That file is not a SQLite database.".into());
    }
    Ok(bytes)
}

fn database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|_| "Could not find the app config folder.".to_string())?;
    Ok(dir.join("kitchen-ro.db"))
}

async fn vacuum_into(source: &Path, destination: &Path) -> Result<(), String> {
    if let Some(parent) = destination.parent() {
        if !parent.as_os_str().is_empty() && !parent.is_dir() {
            return Err("That folder does not exist.".into());
        }
    }
    let partial = PathBuf::from(format!("{}.partial", destination.display()));
    if partial.exists() {
        std::fs::remove_file(&partial)
            .map_err(|err| format!("Could not prepare the backup file: {err}"))?;
    }
    let options = SqliteConnectOptions::new()
        .filename(source)
        .create_if_missing(false)
        .busy_timeout(Duration::from_secs(5));
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .map_err(|err| format!("Could not open the database: {err}"))?;
    let sql_path = partial.to_string_lossy().replace('\\', "/").replace('\'', "''");
    let written = sqlx::raw_sql(&format!("VACUUM INTO '{sql_path}'"))
        .execute(&pool)
        .await;
    pool.close().await;
    if let Err(err) = written {
        let _ = std::fs::remove_file(&partial);
        return Err(format!("Could not write the backup: {err}"));
    }
    move_into_place(&partial, destination)
}

async fn assert_kitchen_database(path: &Path) -> Result<(), String> {
    let options = SqliteConnectOptions::new()
        .filename(path)
        .read_only(true)
        .create_if_missing(false)
        .busy_timeout(Duration::from_secs(5));
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .map_err(|_| "That file could not be opened as a Kitchen RO database.".to_string())?;
    for table in KITCHEN_TABLES {
        let found = sqlx::query::<Sqlite>(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        )
            .bind(table)
            .fetch_optional(&pool)
            .await;
        match found {
            Ok(Some(_)) => {}
            Ok(None) => {
                pool.close().await;
                return Err("That file is not a Kitchen RO database.".into());
            }
            Err(_) => {
                pool.close().await;
                return Err("That file could not be opened as a Kitchen RO database.".into());
            }
        }
    }
    pool.close().await;
    Ok(())
}

fn replace_database_file(from: &Path, to: &Path) -> Result<(), String> {
    let mut last = "the database file is still open".to_string();
    for _ in 0..20 {
        match try_replace_database_file(from, to) {
            Ok(()) => return Ok(()),
            Err(err) => {
                last = err;
                std::thread::sleep(Duration::from_millis(100));
            }
        }
    }
    Err(format!("Could not replace the database file: {last}"))
}

fn try_replace_database_file(from: &Path, to: &Path) -> Result<(), String> {
    let _ = std::fs::remove_file(sidecar(to, "-wal"));
    let _ = std::fs::remove_file(sidecar(to, "-shm"));
    let previous = PathBuf::from(format!("{}.previous", to.display()));
    let _ = std::fs::remove_file(&previous);
    if to.exists() {
        std::fs::rename(to, &previous)
            .map_err(|err| format!("Could not replace the database file: {err}"))?;
    }
    if let Err(err) = std::fs::rename(from, to) {
        let _ = std::fs::rename(&previous, to);
        return Err(format!("Could not replace the database file: {err}"));
    }
    let _ = std::fs::remove_file(&previous);
    Ok(())
}

fn move_into_place(from: &Path, to: &Path) -> Result<(), String> {
    if to.exists() {
        std::fs::remove_file(to).map_err(|err| format!("Could not replace that file: {err}"))?;
    }
    match std::fs::rename(from, to) {
        Ok(()) => Ok(()),
        Err(rename_error) => {
            std::fs::copy(from, to).map_err(|err| {
                format!("Could not write the backup: {rename_error}; {err}")
            })?;
            let _ = std::fs::remove_file(from);
            Ok(())
        }
    }
}

fn sidecar(path: &Path, suffix: &str) -> PathBuf {
    PathBuf::from(format!("{}{suffix}", path.display()))
}

fn same_path(left: &Path, right: &Path) -> bool {
    match (left.canonicalize(), right.canonicalize()) {
        (Ok(left), Ok(right)) => left == right,
        _ => left == right,
    }
}

fn has_sqlite_header(bytes: &[u8]) -> bool {
    bytes.len() >= SQLITE_HEADER.len() && &bytes[..SQLITE_HEADER.len()] == SQLITE_HEADER
}
