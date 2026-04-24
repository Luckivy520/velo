# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Velo is a fast, elegant note-taking desktop application with bi-directional links and knowledge graph visualization.

### Features
- **Bi-directional Links**: Connect notes with `[[wiki-style links]]`
- **Knowledge Graph**: Visualize connections between notes
- **Markdown Support**: Write notes in familiar Markdown syntax
- **Local-First**: Data stays on your device
- **Fast & Lightweight**: Built with Rust for maximum performance
- **Dark Mode**: Built-in dark theme support
- **i18n**: Multi-language support (English/Chinese)

## Architecture

**Frontend**: Vanilla HTML/CSS/JavaScript in `src/` directory
- `main.js`: Main JavaScript file with UI interaction logic
- `index.html`: Main HTML interface
- `styles.css`: Styling
- `api.js`: Tauri command invocations
- `i18n.js`: Internationalization utilities

**Backend**: Rust Tauri application in `src-tauri/` directory
- `main.rs`: Application entry point
- `lib.rs`: Main Tauri setup and command registration

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Rust + Tauri 2.0 |
| Frontend | Vanilla HTML, CSS, JavaScript |
| Database | SQLite (via rusqlite) |

## Development Commands

**Build and Run**:
```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri:dev

# Build for production
npm run tauri:build

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

### Tauri Commands (lib.rs)
The application exposes note operations as Tauri commands:
- **Notes**: CRUD operations for notes
- **Links**: Bi-directional link management
- **Tags**: Tag-based organization
- **Search**: Full-text search across notes
- **Graph**: Knowledge graph data generation

### Frontend Integration
JavaScript functions in `main.js` call Rust commands using `@tauri-apps/api/core` invoke with corresponding command names.

## Database Schema

The application uses SQLite with the following tables:
- **notes**: id, title, content, created_at, updated_at
- **links**: source_id, target_id, created_at
- **tags**: id, name
- **note_tags**: note_id, tag_id

## Security Considerations

The application uses Tauri's security model with:
- Local-only data storage
- No external network requests
- User-controlled data
