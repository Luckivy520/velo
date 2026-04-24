# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Tauri desktop application called "Knife" that provides various system utilities including:
- File system operations (read/write files, directory management)
- Persistent data storage using Tauri's store plugin
- Clipboard management
- Dialog boxes (message, confirm, file/folder selection)
- System utilities

## Architecture

**Frontend**: Vanilla HTML/CSS/JavaScript in `src/` directory
- `main.js`: Main JavaScript file with UI interaction logic
- `index.html`: Main HTML interface
- `styles.css`: Styling

**Backend**: Rust Tauri application in `src-tauri/` directory
- `main.rs`: Application entry point
- `lib.rs`: Main Tauri setup and plugin registration
- `arsenal.rs`: Core command implementations for system operations

## Development Commands

**Build and Run**:
```bash
# Build and run the application
cargo tauri dev

# Build for production
cargo tauri build

# Run Rust tests
cargo test
```

**Rust Development**:
```bash
# Check for compilation errors
cargo check

# Format Rust code
cargo fmt

# Lint Rust code
cargo clippy
```

## Key Components

### Tauri Commands (arsenal.rs)
The application exposes numerous system operations as Tauri commands:
- **Storage**: `store_set`, `store_get`, `store_delete`, `store_get_all_keys`
- **Clipboard**: `clipboard_write_text`, `clipboard_read_text`
- **File System**: File operations using Rust's std::fs
- **Dialogs**: Various dialog types for user interaction

### Frontend Integration
JavaScript functions in `main.js` call Rust commands using `window.__TAURI__.core.invoke()` with corresponding command names.

## Security Considerations

The application uses Tauri's security model with:
- CSP disabled in development
- Tauri plugins for controlled system access
- No external network requests in current implementation

## Plugin Configuration

Tauri plugins used:
- `tauri-plugin-store`: Persistent key-value storage
- `tauri-plugin-sql`: Database support (PostgreSQL)
- `tauri-plugin-clipboard-manager`: Clipboard access
- `tauri-plugin-http`: HTTP requests
- `tauri-plugin-fs`: File system operations
- `tauri-plugin-dialog`: System dialogs
- `tauri-plugin-opener`: URL/file opening