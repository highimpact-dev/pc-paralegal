# PC-Paralegal

Virtual paralegal desktop app built with Tauri v2.

## Stack
- **Shell**: Tauri v2 (Rust backend)
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **LLM**: Ollama (Qwen3-8B) at localhost:11434
- **Doc parsing**: LiteParse CLI
- **Task management**: Paperclip at localhost:3100

## Commands
```bash
bun install              # Install frontend deps
bun run tauri dev        # Run in dev mode
bun run tauri build      # Build for production
bun run build            # Build frontend only
```

## Architecture
- `src-tauri/` - Rust backend (file ops, process management, API proxy)
- `src/` - React frontend (pages, components, libs)
- `agent-scripts/` - TypeScript scripts invoked by Paperclip agents via process adapter

## File System
Working directory: ~/paralegal/
- inbox/ - uploaded documents
- deliverables/ - finished work product
- processing/ - agent workspace
- templates/ - drafting templates
- matters/ - per-case folders
