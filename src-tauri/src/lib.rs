mod arsenal;
mod db;

use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("failed to create app data dir");
            let db_path = app_data_dir.join("velo.db");
            let conn =
                db::init_db(&db_path).expect("failed to initialize database");
            app.manage(db::DbState {
                conn: Mutex::new(conn),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            arsenal::create_note,
            arsenal::get_note,
            arsenal::update_note,
            arsenal::delete_note,
            arsenal::list_notes,
            arsenal::search_notes,
            arsenal::get_backlinks,
            arsenal::get_graph_data,
            arsenal::get_note_by_title,
            arsenal::export_data,
            arsenal::import_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
