# Unite

**Real-time collaborative code editing for teams.**

Unite is a browser-based collaborative IDE built with React, TypeScript, Monaco Editor, Yjs, Hocuspocus, WebContainers, Pyodide, xterm.js, Express, and PostgreSQL/Prisma.

## Key Capabilities
- **Real-time CRDT Collaboration**: Simultaneous multi-user editing via Yjs, `y-monaco`, and Hocuspocus with live cursors, selection highlights, presence awareness, and binary state persistence.
- **Workspaces & Role-Based Access**: Create and join workspaces with cryptographic invitation links/codes and backend-enforced `OWNER`, `EDITOR`, and `VIEWER` roles.
- **File & Folder System**: Synchronized hierarchical file explorer with search, create, rename, and recursive delete.
- **Multi-Language Editor & Execution**:
  - **JavaScript / TypeScript**: Isolated browser execution via WebContainers.
  - **Python**: Isolated browser WebAssembly execution via Pyodide Web Worker.
  - **C / C++ / Java / Go / Rust / PHP**: Server-proxied hosted sandbox execution.
- **Integrated Terminal**: Multi-tab `xterm.js` terminal powered by WebContainer `jsh` shell and authenticated backend terminal gateway.

## Quick Start

```bash
npm install
npm run prisma:generate
npm run dev
```

Open `http://localhost:5173`. See [docs/setup.md](docs/setup.md) for Supabase production setup and deployment instructions.

## Project Structure
- `src/` — React + Vite frontend (`app/`, `components/`, `features/`, `services/`, `lib/`)
- `server/` — Express + Hocuspocus + WebSocket backend (`api/`, `auth/`, `collaboration/`, `database/`, `execution/`, `terminal/`, `security/`, `workspace/`)
- `shared/` — Shared TypeScript types, Zod validation schemas, role permissions, and language definitions
- `prisma/` — PostgreSQL Prisma schema
- `tests/` — Unit, integration, real-time collaboration, and security test suites
- `docs/` — Architecture, API, database, setup, and progress documentation

