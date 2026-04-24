// ============================================================
// api.js — Tauri invoke wrappers for Velo commands
// ============================================================

const { invoke } = window.__TAURI__.core;

export const api = {
    createNote(title, content) {
        return invoke("create_note", { title, content });
    },
    getNote(id) {
        return invoke("get_note", { id });
    },
    updateNote(id, title, content) {
        return invoke("update_note", { id, title, content });
    },
    deleteNote(id) {
        return invoke("delete_note", { id });
    },
    listNotes() {
        return invoke("list_notes");
    },
    searchNotes(query) {
        return invoke("search_notes", { query });
    },
    getBacklinks(noteId) {
        return invoke("get_backlinks", { noteId });
    },
    getGraphData() {
        return invoke("get_graph_data");
    },
    getNoteByTitle(title) {
        return invoke("get_note_by_title", { title });
    },
    exportData() {
        return invoke("export_data");
    },
    importData(jsonStr) {
        return invoke("import_data", { jsonStr });
    },
};
