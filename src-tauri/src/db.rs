use regex::Regex;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::{LazyLock, Mutex};

// ============================================================================
// Data Structures (shared with frontend via serde)
// ============================================================================

#[derive(Serialize, Deserialize, Clone)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct NoteSummary {
    pub id: String,
    pub title: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub title: String,
    pub link_count: usize,
}

#[derive(Serialize, Deserialize)]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
}

// ============================================================================
// Global State
// ============================================================================

pub struct DbState {
    pub conn: Mutex<Connection>,
}

// Pre-compile wikilink regex
static LINK_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[\[([^\]]+)\]\]").unwrap());

// ============================================================================
// Database Initialization
// ============================================================================

pub fn init_db(db_path: &Path) -> Result<Connection, String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .map_err(|e| e.to_string())?;

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS links (
            id TEXT PRIMARY KEY,
            source_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            target_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL,
            UNIQUE(source_id, target_id)
        );

        CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_id);
        CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_id);

        CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
            title,
            content,
            content='notes',
            content_rowid='rowid'
        );

        CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
            INSERT INTO notes_fts(rowid, title, content)
            VALUES (new.rowid, new.title, new.content);
        END;

        CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
            INSERT INTO notes_fts(notes_fts, rowid, title, content)
            VALUES ('delete', old.rowid, old.title, old.content);
        END;

        CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
            INSERT INTO notes_fts(notes_fts, rowid, title, content)
            VALUES ('delete', old.rowid, old.title, old.content);
            INSERT INTO notes_fts(rowid, title, content)
            VALUES (new.rowid, new.title, new.content);
        END;
        ",
    )
    .map_err(|e| e.to_string())?;

    Ok(conn)
}

// ============================================================================
// Helpers
// ============================================================================

fn now_iso() -> String {
    // Simple UTC ISO string without chrono dependency
    let dur = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = dur.as_secs();

    // Manually format as YYYY-MM-DDTHH:MM:SSZ
    let days_since_epoch = secs / 86400;
    let time_of_day = secs % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    // Convert days to year/month/day using civil calendar
    let (y, m, d) = civil_from_days(days_since_epoch as i64);

    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", y, m, d, hours, minutes, seconds)
}

// Simple civil date conversion (no chrono dependency needed)
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719468;
    let era = (if z >= 0 { z } else { z - 146096 }) / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

pub fn extract_link_titles(content: &str) -> Vec<String> {
    LINK_RE
        .captures_iter(content)
        .map(|cap| cap[1].trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

// ============================================================================
// Database Operations
// ============================================================================

pub fn create_note(conn: &Connection, title: &str, content: &str) -> Result<Note, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = now_iso();

    conn.execute(
        "INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, title, content, now, now],
    )
    .map_err(|e| e.to_string())?;

    // Sync links based on content
    sync_links_inner(conn, &id, content)?;

    Ok(Note {
        id,
        title: title.to_string(),
        content: content.to_string(),
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn get_note(conn: &Connection, id: &str) -> Result<Note, String> {
    conn.query_row(
        "SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ?1",
        params![id],
        |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

pub fn update_note(conn: &Connection, id: &str, title: &str, content: &str) -> Result<Note, String> {
    let now = now_iso();

    conn.execute(
        "UPDATE notes SET title = ?1, content = ?2, updated_at = ?3 WHERE id = ?4",
        params![title, content, now, id],
    )
    .map_err(|e| e.to_string())?;

    // Re-sync links
    sync_links_inner(conn, id, content)?;

    Ok(Note {
        id: id.to_string(),
        title: title.to_string(),
        content: content.to_string(),
        created_at: String::new(), // won't be used by frontend after update
        updated_at: now,
    })
}

pub fn delete_note(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn list_notes(conn: &Connection) -> Result<Vec<NoteSummary>, String> {
    let mut stmt = conn
        .prepare("SELECT id, title, updated_at FROM notes ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;

    let notes = stmt
        .query_map([], |row| {
            Ok(NoteSummary {
                id: row.get(0)?,
                title: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(notes)
}

pub fn search_notes(conn: &Connection, query: &str) -> Result<Vec<NoteSummary>, String> {
    // Escape quotes and wrap in double quotes for phrase matching
    let safe = query.replace('"', "\"\"");
    let fts_query = format!("\"{}\"", safe);

    let mut stmt = conn
        .prepare(
            "SELECT n.id, n.title, n.updated_at
             FROM notes n
             JOIN notes_fts fts ON n.rowid = fts.rowid
             WHERE notes_fts MATCH ?1
             ORDER BY rank
             LIMIT 50",
        )
        .map_err(|e| e.to_string())?;

    let notes = stmt
        .query_map(params![fts_query], |row| {
            Ok(NoteSummary {
                id: row.get(0)?,
                title: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(notes)
}

pub fn get_note_by_title(conn: &Connection, title: &str) -> Result<Option<Note>, String> {
    let result = conn.query_row(
        "SELECT id, title, content, created_at, updated_at FROM notes WHERE LOWER(title) = LOWER(?1)",
        params![title],
        |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    );

    match result {
        Ok(note) => Ok(Some(note)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn get_backlinks(conn: &Connection, note_id: &str) -> Result<Vec<NoteSummary>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT n.id, n.title, n.updated_at
             FROM notes n
             JOIN links l ON l.source_id = n.id
             WHERE l.target_id = ?1
             ORDER BY n.updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let notes = stmt
        .query_map(params![note_id], |row| {
            Ok(NoteSummary {
                id: row.get(0)?,
                title: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(notes)
}

pub fn get_graph_data(conn: &Connection) -> Result<GraphData, String> {
    let mut node_stmt = conn
        .prepare(
            "SELECT n.id, n.title,
                    (SELECT COUNT(*) FROM links WHERE source_id = n.id) +
                    (SELECT COUNT(*) FROM links WHERE target_id = n.id) as link_count
             FROM notes n
             ORDER BY n.title",
        )
        .map_err(|e| e.to_string())?;

    let nodes: Vec<GraphNode> = node_stmt
        .query_map([], |row| {
            Ok(GraphNode {
                id: row.get(0)?,
                title: row.get(1)?,
                link_count: row.get::<_, i64>(2)? as usize,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut edge_stmt = conn
        .prepare("SELECT source_id, target_id FROM links")
        .map_err(|e| e.to_string())?;

    let edges: Vec<GraphEdge> = edge_stmt
        .query_map([], |row| {
            Ok(GraphEdge {
                source: row.get(0)?,
                target: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(GraphData { nodes, edges })
}

// ============================================================================
// Import / Export
// ============================================================================

#[derive(Serialize, Deserialize)]
pub struct ExportData {
    pub notes: Vec<Note>,
    pub links: Vec<ExportLink>,
}

#[derive(Serialize, Deserialize)]
pub struct ExportLink {
    pub source_id: String,
    pub target_id: String,
    pub created_at: String,
}

pub fn export_all(conn: &Connection) -> Result<ExportData, String> {
    let mut stmt = conn
        .prepare("SELECT id, title, content, created_at, updated_at FROM notes ORDER BY created_at")
        .map_err(|e| e.to_string())?;

    let notes: Vec<Note> = stmt
        .query_map([], |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut link_stmt = conn
        .prepare("SELECT source_id, target_id, created_at FROM links ORDER BY created_at")
        .map_err(|e| e.to_string())?;

    let links: Vec<ExportLink> = link_stmt
        .query_map([], |row| {
            Ok(ExportLink {
                source_id: row.get(0)?,
                target_id: row.get(1)?,
                created_at: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(ExportData { notes, links })
}

pub fn import_all(conn: &Connection, data: &ExportData) -> Result<(usize, usize), String> {
    let mut note_count = 0;
    let mut link_count = 0;

    for note in &data.notes {
        // Insert or replace based on id
        conn.execute(
            "INSERT OR REPLACE INTO notes (id, title, content, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![note.id, note.title, note.content, note.created_at, note.updated_at],
        )
        .map_err(|e| e.to_string())?;
        note_count += 1;
    }

    for link in &data.links {
        conn.execute(
            "INSERT OR IGNORE INTO links (id, source_id, target_id, created_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![uuid::Uuid::new_v4().to_string(), link.source_id, link.target_id, link.created_at],
        )
        .map_err(|e| e.to_string())?;
        link_count += 1;
    }

    Ok((note_count, link_count))
}

// ============================================================================
// Link Sync (internal)
// ============================================================================

fn sync_links_inner(conn: &Connection, source_id: &str, content: &str) -> Result<(), String> {
    // Delete old links from this source
    conn.execute(
        "DELETE FROM links WHERE source_id = ?1",
        params![source_id],
    )
    .map_err(|e| e.to_string())?;

    // Extract [[titles]] from content
    let titles = extract_link_titles(content);

    for title in titles {
        // Find target note by title (case-insensitive)
        let target = conn.query_row(
            "SELECT id FROM notes WHERE LOWER(title) = LOWER(?1)",
            params![title],
            |row| row.get::<_, String>(0),
        );

        if let Ok(target_id) = target {
            let link_id = uuid::Uuid::new_v4().to_string();
            let now = now_iso();
            // Skip if already exists (shouldn't since we deleted, but safe)
            conn.execute(
                "INSERT OR IGNORE INTO links (id, source_id, target_id, created_at) VALUES (?1, ?2, ?3, ?4)",
                params![link_id, source_id, target_id, now],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}
