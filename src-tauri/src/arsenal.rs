use crate::db;
use tauri::State;

// ============================================================================
// Import / Export Commands
// ============================================================================

#[tauri::command]
pub fn export_data(
    state: State<'_, db::DbState>,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let data = db::export_all(&conn)?;
    serde_json::to_value(data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_data(
    state: State<'_, db::DbState>,
    json_str: String,
) -> Result<(usize, usize), String> {
    let data: db::ExportData = serde_json::from_str(&json_str).map_err(|e| e.to_string())?;
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::import_all(&conn, &data)
}

// ============================================================================
// Note CRUD Commands
// ============================================================================

#[tauri::command]
pub fn create_note(
    state: State<'_, db::DbState>,
    title: String,
    content: String,
) -> Result<db::Note, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::create_note(&conn, &title, &content)
}

#[tauri::command]
pub fn get_note(
    state: State<'_, db::DbState>,
    id: String,
) -> Result<db::Note, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::get_note(&conn, &id)
}

#[tauri::command]
pub fn update_note(
    state: State<'_, db::DbState>,
    id: String,
    title: String,
    content: String,
) -> Result<db::Note, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::update_note(&conn, &id, &title, &content)
}

#[tauri::command]
pub fn delete_note(
    state: State<'_, db::DbState>,
    id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::delete_note(&conn, &id)
}

#[tauri::command]
pub fn list_notes(
    state: State<'_, db::DbState>,
) -> Result<Vec<db::NoteSummary>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::list_notes(&conn)
}

// ============================================================================
// Search & Link Commands
// ============================================================================

#[tauri::command]
pub fn search_notes(
    state: State<'_, db::DbState>,
    query: String,
) -> Result<Vec<db::NoteSummary>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::search_notes(&conn, &query)
}

#[tauri::command]
pub fn get_backlinks(
    state: State<'_, db::DbState>,
    note_id: String,
) -> Result<Vec<db::NoteSummary>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::get_backlinks(&conn, &note_id)
}

#[tauri::command]
pub fn get_graph_data(
    state: State<'_, db::DbState>,
) -> Result<db::GraphData, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::get_graph_data(&conn)
}

#[tauri::command]
pub fn get_note_by_title(
    state: State<'_, db::DbState>,
    title: String,
) -> Result<Option<db::Note>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::get_note_by_title(&conn, &title)
}
