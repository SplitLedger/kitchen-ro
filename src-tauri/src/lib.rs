mod backup;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            backup::save_database_backup,
            backup::pick_database_backup,
            backup::install_database_backup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
