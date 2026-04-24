# Velo

A fast, elegant note-taking app with bi-directional links and knowledge graph. Your thoughts, beautifully connected.

![Rust](https://img.shields.io/badge/Rust-1.70+-orange)
![Tauri](https://img.shields.io/badge/Tauri-2.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Bi-directional Links**: Connect your notes with `[[wiki-style links]]`
- **Knowledge Graph**: Visualize connections between your notes
- **Markdown Support**: Write notes in familiar Markdown syntax
- **Local-First**: Your data stays on your device
- **Fast & Lightweight**: Built with Rust for maximum performance

## Tech Stack

- **Backend**: Rust + Tauri
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Database**: SQLite

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/) 1.70+
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/setup/)

### Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri:dev
```

### Build

```bash
npm run tauri:build
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + N` | New Note |
| `Ctrl + K` | Search |
| `Ctrl + S` | Save |

## License

MIT
