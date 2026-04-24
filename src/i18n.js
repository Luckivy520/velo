// ============================================================
// i18n.js — Internationalization (Chinese / English)
// ============================================================

const translations = {
    en: {
        // App
        appTitle: "Velo",
        appSubtitle: "Notes",
        
        // Sidebar
        newNote: "+ New Note",
        searchPlaceholder: "Search notes... ({mod}+K)",
        noNoteSelected: "No note selected",
        noBacklinks: "No backlinks",
        
        // Editor
        titlePlaceholder: "Note title",
        contentPlaceholder: "Start writing... Use [[title]] to create links",
        chars: "chars",
        
        // Buttons
        save: "Save",
        delete: "Delete",
        preview: "Preview",
        edit: "Edit",
        import: "Import",
        export: "Export",
        
        // Status
        saving: "Saving...",
        saved: "Saved",
        unsaved: "Unsaved",
        saveFailed: "Save failed",
        exportSuccess: "Exported {count} notes",
        exportFailed: "Export failed",
        importSuccess: "Import successful",
        importFailed: "Import failed, please check file format",
        
        // Dialogs
        deleteConfirm: "Are you sure you want to delete this note? This action cannot be undone.",
        
        // Empty states
        noNotes: "No notes",
        untitled: "Untitled",
        
        // Settings
        settings: "Settings",
        theme: "Theme",
        lightMode: "Light",
        darkMode: "Dark",
        language: "Language",
        chinese: "Chinese",
        english: "English",
        shortcuts: "Shortcuts",
        shortcutNew: "New note",
        shortcutSearch: "Search",
        shortcutSave: "Save",
        shortcutToggleSidebar: "Toggle sidebar",
        shortcutTogglePreview: "Toggle preview",
        
        // Right panel
        backlinks: "Backlinks",
        graph: "Graph",
    },
    
    zh: {
        // App
        appTitle: "Velo",
        appSubtitle: "笔记",
        
        // Sidebar
        newNote: "+ 新建笔记",
        searchPlaceholder: "搜索笔记... ({mod}+K)",
        noNoteSelected: "未选中笔记",
        noBacklinks: "暂无反向链接",
        
        // Editor
        titlePlaceholder: "笔记标题",
        contentPlaceholder: "开始写作... 使用 [[标题]] 创建链接",
        chars: "字符",
        
        // Buttons
        save: "保存",
        delete: "删除",
        preview: "预览",
        edit: "编辑",
        import: "导入",
        export: "导出",
        
        // Status
        saving: "保存中...",
        saved: "已保存",
        unsaved: "未保存",
        saveFailed: "保存失败",
        exportSuccess: "已导出 {count} 篇笔记",
        exportFailed: "导出失败",
        importSuccess: "导入成功",
        importFailed: "导入失败，请检查文件格式",
        
        // Dialogs
        deleteConfirm: "确定要删除这篇笔记吗？此操作不可撤销。",
        
        // Empty states
        noNotes: "暂无笔记",
        untitled: "未命名",
        
        // Settings
        settings: "设置",
        theme: "主题",
        lightMode: "浅色",
        darkMode: "深色",
        language: "语言",
        chinese: "中文",
        english: "英文",
        shortcuts: "快捷键",
        shortcutNew: "新建笔记",
        shortcutSearch: "搜索",
        shortcutSave: "保存",
        shortcutToggleSidebar: "切换侧边栏",
        shortcutTogglePreview: "切换预览",
        
        // Right panel
        backlinks: "反向链接",
        graph: "图谱",
    }
};

// Current language (default to English)
let currentLang = localStorage.getItem("velo-lang") || "en";

// Get translation
function t(key, replacements = {}) {
    const text = translations[currentLang][key] || translations.en[key] || key;
    
    // Replace placeholders
    for (const [k, v] of Object.entries(replacements)) {
        if (k === "mod") {
            const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
            text.replace(`{${k}}`, isMac ? "Cmd" : "Ctrl");
        }
    }
    
    return text.replace(/\{(\w+)\}/g, (_, k) => replacements[k] !== undefined ? replacements[k] : `{${k}}`);
}

// Set language
function setLanguage(lang) {
    if (translations[lang]) {
        currentLang = lang;
        localStorage.setItem("velo-lang", lang);
        applyTranslations();
    }
}

// Apply translations to all elements with data-i18n attribute
function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        const replacements = {};
        
        // Get mod key replacement
        const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
        replacements.mod = isMac ? "Cmd" : "Ctrl";
        
        el.textContent = t(key, replacements);
    });
    
    // Update placeholders
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
        const key = el.getAttribute("data-i18n-placeholder");
        const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
        el.placeholder = t(key, { mod: isMac ? "Cmd" : "Ctrl" });
    });
    
    // Update aria-labels
    document.querySelectorAll("[data-i18n-title]").forEach(el => {
        const key = el.getAttribute("data-i18n-title");
        el.title = t(key);
    });
}

// Export for use in other modules
export { t, setLanguage, applyTranslations };
