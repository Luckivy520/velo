// ============================================================
// main.js — Velo App Orchestration
// ============================================================

import { api } from "./api.js";
import "./i18n.js";

// ============================================================================
// Platform Detection
// ============================================================================

const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const modKey = isMac ? "Cmd" : "Ctrl";

// ============================================================================
// Shared State
// ============================================================================

let currentNoteId = null;
let currentNote = null;
let isPreview = false;
let autoSaveTimer = null;
let noteListCache = [];
let graphDataCache = null;
let graphNodePositions = null;
let currentTheme = localStorage.getItem("velo-theme") || "light";
let isSettingsOpen = false;

// ============================================================================
// DOM References
// ============================================================================

const $ = (sel) => document.querySelector(sel);

const sidebar = {
    noteList: $("#note-list"),
    searchInput: $("#search-input"),
    newBtn: $("#btn-new-note"),
};

const editor = {
    titleInput: $("#title-input"),
    contentInput: $("#content-input"),
    previewPane: $("#preview-pane"),
    saveBtn: $("#btn-save"),
    deleteBtn: $("#btn-delete"),
    togglePreviewBtn: $("#btn-toggle-preview"),
    wordCount: $("#word-count"),
    saveStatus: $("#save-status"),
};

const rightPanel = {
    graphCanvas: $("#graph-canvas"),
    graphContainer: $("#graph-container"),
    backlinksList: $("#backlinks-list"),
};

// ============================================================================
// Helpers
// ============================================================================

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

// ============================================================================
// Theme Management
// ============================================================================

function applyTheme(theme) {
    currentTheme = theme;
    localStorage.setItem("velo-theme", theme);
    
    if (theme === "dark") {
        document.body.classList.add("dark");
    } else {
        document.body.classList.remove("dark");
    }
    
    // Update button states
    document.getElementById("btn-theme-light").classList.toggle("active", theme === "light");
    document.getElementById("btn-theme-dark").classList.toggle("active", theme === "dark");
    
    // Re-render graph with new colors
    if (graphDataCache) {
        renderGraph();
    }
}

function toggleTheme() {
    applyTheme(currentTheme === "light" ? "dark" : "light");
}

// ============================================================================
// Settings Modal
// ============================================================================

function openSettings() {
    isSettingsOpen = true;
    document.getElementById("settings-modal").classList.remove("hidden");
    updateSettingsUI();
}

function closeSettings() {
    isSettingsOpen = false;
    document.getElementById("settings-modal").classList.add("hidden");
}

function updateSettingsUI() {
    // Update theme buttons
    document.getElementById("btn-theme-light").classList.toggle("active", currentTheme === "light");
    document.getElementById("btn-theme-dark").classList.toggle("active", currentTheme === "dark");
    
    // Update language buttons
    const lang = localStorage.getItem("velo-lang") || "en";
    document.getElementById("btn-lang-en").classList.toggle("active", lang === "en");
    document.getElementById("btn-lang-zh").classList.toggle("active", lang === "zh");
}

function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

function formatDate(isoStr) {
    if (!isoStr) return "";
    try {
        const d = new Date(isoStr);
        const pad = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
        return isoStr.slice(0, 16);
    }
}

function countChars(text) {
    return text.replace(/\s/g, "").length;
}

// ============================================================================
// Sidebar — Note List & Search
// ============================================================================

async function loadNoteList() {
    try {
        noteListCache = await api.listNotes();
        renderNoteList();
    } catch (e) {
        console.error("Failed to load note list:", e);
    }
}

function renderNoteList() {
    sidebar.noteList.innerHTML = noteListCache
        .map(
            (n) => `
        <li class="note-item${n.id === currentNoteId ? " active" : ""}"
            data-note-id="${n.id}">
          <span class="note-item-title">${escapeHtml(n.title || "Untitled")}</span>
          <span class="note-item-date">${formatDate(n.updated_at)}</span>
        </li>`
        )
        .join("");
}

async function selectNote(id) {
    if (id === currentNoteId) return;
    autoSaveNow();

    try {
        currentNote = await api.getNote(id);
        currentNoteId = id;
    } catch (e) {
        console.error("Failed to load note:", e);
        return;
    }

    editor.titleInput.value = currentNote.title;
    editor.contentInput.value = currentNote.content;
    editor.wordCount.textContent = `${countChars(currentNote.content)} chars`;

    if (isPreview) renderPreview();

    renderNoteList();
    loadBacklinks(id);
    highlightGraphNode(id);

    setSaveStatus("");
}

async function createNewNote() {
    autoSaveNow();

    try {
        const note = await api.createNote("", "");
        currentNoteId = note.id;
        currentNote = note;
        editor.titleInput.value = "";
        editor.contentInput.value = "";
        editor.wordCount.textContent = "0 chars";
        editor.titleInput.focus();

        await loadNoteList();
        loadBacklinks(null);
        loadGraphData();
        setSaveStatus("");
    } catch (e) {
        console.error("Failed to create note:", e);
    }
}

async function navigateToNoteByTitle(title) {
    autoSaveNow();

    try {
        const note = await api.getNoteByTitle(title);
        if (note) {
            await selectNote(note.id);
        } else {
            // Create new note with this title
            const note = await api.createNote(title, "");
            currentNoteId = note.id;
            currentNote = note;
            editor.titleInput.value = title;
            editor.contentInput.value = "";
            editor.wordCount.textContent = "0 chars";
            await loadNoteList();
            loadBacklinks(null);
            loadGraphData();
            setSaveStatus("");
            renderNoteList();
        }
    } catch (e) {
        console.error("Failed to navigate:", e);
    }
}

// Search (debounced)
const handleSearch = debounce(async () => {
    const query = sidebar.searchInput.value.trim();
    if (!query) {
        await loadNoteList();
        return;
    }
    try {
        noteListCache = await api.searchNotes(query);
        renderNoteList();
    } catch (e) {
        console.error("Search failed:", e);
    }
}, 300);

// ============================================================================
// Editor — Save, Delete, Preview
// ============================================================================

async function saveNote() {
    const title = editor.titleInput.value.trim();
    const content = editor.contentInput.value;

    setSaveStatus("saving", "Saving...");

    try {
        if (currentNoteId) {
            currentNote = await api.updateNote(currentNoteId, title, content);
        } else {
            currentNote = await api.createNote(title || "Untitled", content);
            currentNoteId = currentNote.id;
        }

        editor.wordCount.textContent = `${countChars(content)} chars`;
        setSaveStatus("saved", "Saved");

        await loadNoteList();
        await loadBacklinks(currentNoteId);
        await loadGraphData();

        if (isPreview) renderPreview();
    } catch (e) {
        console.error("Save failed:", e);
        setSaveStatus("error", "Save failed");
    }
}

function autoSaveNow() {
    clearTimeout(autoSaveTimer);
    if (!currentNoteId && !editor.titleInput.value.trim() && !editor.contentInput.value) return;
    // Only auto-save if note already exists or has content
    if (currentNoteId) {
        saveNote();
    }
}

function scheduleAutoSave() {
    clearTimeout(autoSaveTimer);
    if (!currentNoteId) return;
    setSaveStatus("saving", "Unsaved");
    autoSaveTimer = setTimeout(saveNote, 1000);
}

async function deleteCurrentNote() {
    if (!currentNoteId) return;

    const confirmed = window.confirm("Are you sure you want to delete this note? This action cannot be undone.");

    if (!confirmed) return;

    try {
        await api.deleteNote(currentNoteId);
        currentNoteId = null;
        currentNote = null;
        editor.titleInput.value = "";
        editor.contentInput.value = "";
        editor.wordCount.textContent = "0 chars";
        editor.previewPane.innerHTML = "";
        setSaveStatus("");

        await loadNoteList();
        loadBacklinks(null);
        loadGraphData();
    } catch (e) {
        console.error("Delete failed:", e);
    }
}

function setSaveStatus(cls, text) {
    editor.saveStatus.className = cls;
    editor.saveStatus.textContent = text;
}

// ============================================================================
// Preview & Wikilinks
// ============================================================================

function renderPreview() {
    const content = editor.contentInput.value;
    let html = "";

    if (typeof marked !== "undefined") {
        // Configure marked
        marked.setOptions({ breaks: true, gfm: true });
        html = marked.parse(content);
    } else {
        html = escapeHtml(content).replace(/\n/g, "<br>");
    }

    // Convert [[wikilinks]] — handle both those in and out of code blocks
    html = html.replace(
        /\[\[([^\]]+)\]\]/g,
        (_, title) =>
            `<span class="wikilink" data-title="${escapeHtml(title.trim())}">${escapeHtml(title.trim())}</span>`
    );

    editor.previewPane.innerHTML = html;
}

function togglePreview() {
    isPreview = !isPreview;
    if (isPreview) {
        renderPreview();
        editor.contentInput.classList.add("hidden");
        editor.previewPane.classList.remove("hidden");
        editor.togglePreviewBtn.textContent = "Edit";
    } else {
        editor.contentInput.classList.remove("hidden");
        editor.previewPane.classList.add("hidden");
        editor.togglePreviewBtn.textContent = "Preview";
    }
}

// ============================================================================
// Backlinks
// ============================================================================

async function loadBacklinks(noteId) {
    if (!noteId) {
        rightPanel.backlinksList.innerHTML = `<li class="backlink-empty">${t("noNoteSelected")}</li>`;
        return;
    }

    try {
        const backlinks = await api.getBacklinks(noteId);
        if (backlinks.length === 0) {
            rightPanel.backlinksList.innerHTML = `<li class="backlink-empty">${t("noBacklinks")}</li>`;
            return;
        }
        renderBacklinks(backlinks);
    } catch (e) {
        console.error("Failed to load backlinks:", e);
    }
}

function renderBacklinks(backlinks) {
    rightPanel.backlinksList.innerHTML = backlinks
        .map(
            (b) => `
        <li class="backlink-item" data-note-id="${b.id}">
          ${escapeHtml(b.title || t("untitled"))}
        </li>`
        )
        .join("");
}

// ============================================================================
// Knowledge Graph — Force-Directed Layout (Canvas)
// ============================================================================

async function loadGraphData() {
    try {
        graphDataCache = await api.getGraphData();
        // Reset positions when data changes
        if (graphDataCache.nodes.length > 0) {
            initNodePositions();
        }
        renderGraph();
    } catch (e) {
        console.error("Failed to load graph data:", e);
    }
}

function initNodePositions() {
    const canvas = rightPanel.graphCanvas;
    const w = canvas.width || canvas.clientWidth || 320;
    const h = canvas.height || canvas.clientHeight || 200;
    const cx = w / 2;
    const cy = h / 2;
    const spread = Math.min(w, h) * 0.35;

    graphNodePositions = {};
    for (const node of graphDataCache.nodes) {
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.random() * spread;
        graphNodePositions[node.id] = {
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
        };
    }
}

function runForceSimulation(iterations) {
    const nodes = graphDataCache.nodes;
    const edges = graphDataCache.edges;
    const area = (rightPanel.graphCanvas.width || 320) * (rightPanel.graphCanvas.height || 200);
    const k = Math.sqrt(area / Math.max(nodes.length, 1));
    const maxIter = iterations || Math.min(100, nodes.length * 10);

    for (let iter = 0; iter < maxIter; iter++) {
        const temp = k * 0.5 * (1 - iter / maxIter);

        // Repulsive forces
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const pi = graphNodePositions[nodes[i].id];
                const pj = graphNodePositions[nodes[j].id];
                let dx = pi.x - pj.x;
                let dy = pi.y - pj.y;
                const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
                const force = (k * k) / dist;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                pi.x += fx;
                pi.y += fy;
                pj.x -= fx;
                pj.y -= fy;
            }
        }

        // Attractive forces (edges)
        for (const edge of edges) {
            const ps = graphNodePositions[edge.source];
            const pt = graphNodePositions[edge.target];
            if (!ps || !pt) continue;
            let dx = pt.x - ps.x;
            let dy = pt.y - ps.y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const force = (dist * dist) / k;
            const fx = (dx / dist) * force * 0.3;
            const fy = (dy / dist) * force * 0.3;
            ps.x += fx;
            ps.y += fy;
            pt.x -= fx;
            pt.y -= fy;
        }

        // Center gravity
        const cx = (rightPanel.graphCanvas.width || 320) / 2;
        const cy = (rightPanel.graphCanvas.height || 200) / 2;
        for (const node of nodes) {
            const p = graphNodePositions[node.id];
            p.x += (cx - p.x) * 0.01;
            p.y += (cy - p.y) * 0.01;
        }

        // Apply cooling
        for (const node of nodes) {
            const p = graphNodePositions[node.id];
            p.x = Math.max(20, Math.min(p.x, (rightPanel.graphCanvas.width || 320) - 20));
            p.y = Math.max(20, Math.min(p.y, (rightPanel.graphCanvas.height || 200) - 20));
        }
    }
}

function renderGraph() {
    const canvas = rightPanel.graphCanvas;
    const container = rightPanel.graphContainer;
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    if (!graphDataCache || graphDataCache.nodes.length === 0) {
        ctx.fillStyle = currentTheme === "dark" ? "#6b6358" : "#b8a88a";
        ctx.font = "13px serif";
        ctx.textAlign = "center";
        ctx.fillText(t("noNotes"), w / 2, h / 2);
        return;
    }

    // Apply zoom and pan transform
    ctx.save();
    const cx = w / 2;
    const cy = h / 2;
    ctx.translate(cx + graphPanX, cy + graphPanY);
    ctx.scale(graphScale, graphScale);
    ctx.translate(-cx, -cy);

    // Run force simulation
    runForceSimulation();

    // Draw edges
    ctx.strokeStyle = currentTheme === "dark" ? "#3a3a42" : "#d4c5a8";
    ctx.lineWidth = 0.8;
    for (const edge of graphDataCache.edges) {
        const ps = graphNodePositions[edge.source];
        const pt = graphNodePositions[edge.target];
        if (!ps || !pt) continue;
        ctx.beginPath();
        ctx.moveTo(ps.x, ps.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
    }

    // Draw nodes
    const maxLinks = Math.max(1, ...graphDataCache.nodes.map((n) => n.link_count));
    for (const node of graphDataCache.nodes) {
        const p = graphNodePositions[node.id];
        if (!p) continue;

        const radius = 6 + (node.link_count / maxLinks) * 14;
        const isActive = node.id === currentNoteId;

        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);

        const accentColor = currentTheme === "dark" ? "#d4a84b" : "#b8860b";
        const shadowAlpha = currentTheme === "dark" ? "0.6" : "0.5";
        
        if (isActive) {
            ctx.fillStyle = accentColor;
            ctx.shadowColor = `rgba(212, 168, 75, ${shadowAlpha})`;
            ctx.shadowBlur = 8;
        } else {
            const alpha = 0.4 + (node.link_count / maxLinks) * 0.6;
            ctx.fillStyle = currentTheme === "dark" 
                ? `rgba(212, 168, 75, ${alpha})` 
                : `rgba(184, 134, 11, ${alpha})`;
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label
        if (isActive || node.link_count > 0) {
            const label = node.title.length > 6 ? node.title.slice(0, 6) + ".." : node.title;
            ctx.fillStyle = isActive 
                ? (currentTheme === "dark" ? "#e8e4dc" : "#3d3222") 
                : (currentTheme === "dark" ? "#a09888" : "#8b7355");
            ctx.font = `${isActive ? "bold " : ""}11px serif`;
            ctx.textAlign = "center";
            ctx.fillText(label || t("untitled"), p.x, p.y + radius + 14);
        }
    }

    ctx.restore();
}

function highlightGraphNode(noteId) {
    if (!graphDataCache) return;
    renderGraph();
}

// Graph click handler
function handleGraphClick(e) {
    const canvas = rightPanel.graphCanvas;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Reverse zoom/pan to get world coordinates
    const container = rightPanel.graphContainer;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const x = (mx - w / 2 - graphPanX) / graphScale + w / 2;
    const y = (my - h / 2 - graphPanY) / graphScale + h / 2;

    if (!graphDataCache || !graphNodePositions) return;

    // Find nearest node within click radius (scaled by zoom)
    const clickRadius = 20 / graphScale;
    for (const node of graphDataCache.nodes) {
        const p = graphNodePositions[node.id];
        if (!p) continue;
        const dx = p.x - x;
        const dy = p.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < clickRadius) {
            selectNote(node.id);
            return;
        }
    }
}

// Graph resize
const handleGraphResize = debounce(() => {
    if (graphDataCache) renderGraph();
}, 200);

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

function handleKeydown(e) {
    const mod = e.ctrlKey || e.metaKey;
    
    // Don't trigger shortcuts when modal is open
    if (isSettingsOpen) {
        if (e.key === "Escape") {
            closeSettings();
        }
        return;
    }

    if (mod && e.key === "n") {
        e.preventDefault();
        createNewNote();
    } else if (mod && e.key === "k") {
        e.preventDefault();
        sidebar.searchInput.focus();
    } else if (mod && e.key === "s") {
        e.preventDefault();
        saveNote();
    } else if (mod && e.key === "b") {
        e.preventDefault();
        // Toggle sidebar visibility
        const sb = document.querySelector("#sidebar");
        sb.style.display = sb.style.display === "none" ? "" : "none";
    } else if (mod && e.key === "p") {
        e.preventDefault();
        togglePreview();
    } else if (e.key === "Escape") {
        if (isSettingsOpen) {
            closeSettings();
        }
    }
}

// ============================================================================
// Import / Export
// ============================================================================

async function handleExport() {
    try {
        const data = await api.exportData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        const now = new Date();
        const ds = now.toISOString().slice(0, 10);
        a.download = `velo-backup-${ds}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setSaveStatus("saved", t("exportSuccess", { count: data.notes.length }));
    } catch (e) {
        console.error("Export failed:", e);
        setSaveStatus("error", t("exportFailed"));
    }
}

function handleImport() {
    const input = document.querySelector("#import-file-input");
    input.value = ""; // Reset so same file can be re-selected
    input.click();
}

async function processImport(file) {
    if (!file) return;
    try {
        const text = await file.text();
        await api.importData(text);
        setSaveStatus("saved", t("importSuccess"));
        await loadNoteList();
        await loadGraphData();
        if (currentNoteId) {
            await selectNote(currentNoteId);
        }
    } catch (e) {
        console.error("Import failed:", e);
        setSaveStatus("error", t("importFailed"));
    }
}

// ============================================================================
// Graph canvas zoom & pan
// ============================================================================

let graphScale = 1;
let graphPanX = 0;
let graphPanY = 0;
let isGraphDragging = false;
let graphDragStart = { x: 0, y: 0 };

function handleGraphWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    graphScale = Math.max(0.2, Math.min(3, graphScale * delta));
    renderGraph();
}

function handleGraphMouseDown(e) {
    isGraphDragging = true;
    graphDragStart = { x: e.clientX - graphPanX, y: e.clientY - graphPanY };
    rightPanel.graphCanvas.style.cursor = "grabbing";
}

function handleGraphMouseMove(e) {
    if (!isGraphDragging) return;
    graphPanX = e.clientX - graphDragStart.x;
    graphPanY = e.clientY - graphDragStart.y;
    renderGraph();
}

function handleGraphMouseUp() {
    isGraphDragging = false;
    rightPanel.graphCanvas.style.cursor = "default";
}

// ============================================================================
// Initialization
// ============================================================================

async function init() {
    // Apply saved theme
    applyTheme(currentTheme);
    
    // Apply translations
    applyTranslations();
    
    // Update placeholder with platform-aware shortcut
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    sidebar.searchInput.placeholder = `Search notes... (${isMac ? "Cmd" : "Ctrl"}+K)`;

    // Sidebar events
    sidebar.newBtn.addEventListener("click", createNewNote);
    sidebar.searchInput.addEventListener("input", handleSearch);
    sidebar.noteList.addEventListener("click", (e) => {
        const item = e.target.closest(".note-item");
        if (item) selectNote(item.dataset.noteId);
    });

    // Editor events
    editor.saveBtn.addEventListener("click", saveNote);
    editor.deleteBtn.addEventListener("click", deleteCurrentNote);
    editor.togglePreviewBtn.addEventListener("click", togglePreview);
    editor.contentInput.addEventListener("input", () => {
        const charCount = countChars(editor.contentInput.value);
        editor.wordCount.innerHTML = `${charCount} <span data-i18n="chars">chars</span>`;
        scheduleAutoSave();
    });
    editor.titleInput.addEventListener("input", scheduleAutoSave);

    // Preview wikilink clicks
    editor.previewPane.addEventListener("click", (e) => {
        const link = e.target.closest(".wikilink");
        if (link) {
            const title = link.dataset.title;
            if (title) navigateToNoteByTitle(title);
        }
    });

    // Right panel — backlinks clicks
    rightPanel.backlinksList.addEventListener("click", (e) => {
        const item = e.target.closest(".backlink-item");
        if (item) selectNote(item.dataset.noteId);
    });

    // Graph events — click, zoom, pan
    rightPanel.graphCanvas.addEventListener("click", handleGraphClick);
    rightPanel.graphCanvas.addEventListener("wheel", handleGraphWheel, { passive: false });
    rightPanel.graphCanvas.addEventListener("mousedown", handleGraphMouseDown);
    window.addEventListener("mousemove", handleGraphMouseMove);
    window.addEventListener("mouseup", handleGraphMouseUp);
    window.addEventListener("resize", handleGraphResize);

    // Import/Export
    document.querySelector("#btn-export").addEventListener("click", handleExport);
    document.querySelector("#btn-import").addEventListener("click", handleImport);
    document.querySelector("#import-file-input").addEventListener("change", (e) => {
        processImport(e.target.files[0]);
    });

    // Settings modal
    document.getElementById("btn-settings").addEventListener("click", openSettings);
    document.getElementById("btn-close-settings").addEventListener("click", closeSettings);
    document.querySelector(".modal-overlay").addEventListener("click", closeSettings);
    
    // Theme buttons
    document.getElementById("btn-theme-light").addEventListener("click", () => applyTheme("light"));
    document.getElementById("btn-theme-dark").addEventListener("click", () => applyTheme("dark"));
    
    // Language buttons
    document.getElementById("btn-lang-en").addEventListener("click", () => {
        setLanguage("en");
        updateSettingsUI();
        renderBacklinks();
    });
    document.getElementById("btn-lang-zh").addEventListener("click", () => {
        setLanguage("zh");
        updateSettingsUI();
        renderBacklinks();
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", handleKeydown);

    // Initial data load
    await loadNoteList();
    await loadGraphData();
}

document.addEventListener("DOMContentLoaded", init);
