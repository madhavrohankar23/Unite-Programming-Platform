# Unite — System Architecture

## 1. Overview

Unite is a browser-based, real-time collaborative Web IDE built as a modular monorepo without container-based deployment requirements.

## 2. Core Services & Boundaries

- **Frontend (`src/`)**: React 19 + TypeScript + Vite SPA with Tailwind CSS, Framer Motion, Monaco Editor, Yjs (`y-monaco`), Hocuspocus client, xterm.js, WebContainers (JS/Node), and Pyodide (Python).
- **Backend (`server/`)**: Persistent Node.js + Express + TypeScript server hosting:
  - Authenticated REST API (`/api/*`) with Zod request validation and rate limiting.
  - Hocuspocus WebSocket Collaboration Server (`/collab`) for file-level Yjs CRDT synchronization and Awareness presence.
  - Workspace Events WebSocket Hub (`/ws/events`) for real-time file-tree, member, and chat updates.
  - Hosted Execution Proxy (`POST /api/workspaces/:workspaceId/execute`) for compiled/server-side languages (C, C++, Java, Go, Rust, PHP) without executing arbitrary code on the Express host.
  - Authenticated Terminal Gateway (`/ws/terminal`) for optional remote sandbox terminal delegation.
- **Shared (`shared/`)**: Single source of truth for TypeScript DTOs, Zod validation schemas, role permission checks, and language definitions.
- **Database (`prisma/` & `server/src/database/`)**:
  - Production: Supabase PostgreSQL via Prisma ORM (`STORAGE_DRIVER=prisma`).
  - Local / Zero-Config Development: Embedded PostgreSQL via PGlite (`STORAGE_DRIVER=pglite`) persisted in `.unite-data/pgdata`, running the exact PostgreSQL schema so workspace files and Yjs CRDT documents survive restarts without Docker.

## 3. Authentication & Security Model

- **Production (`AUTH_PROVIDER=supabase`)**: Supabase Auth issues JWTs; backend verifies tokens against Supabase (`SUPABASE_URL`/`SUPABASE_ANON_KEY` or `SUPABASE_JWT_SECRET`) and synchronizes `UserProfile` records.
- **Local/CI Mode (`AUTH_PROVIDER=local`)**: Real `scrypt` password hashing + HS256 JWT signing (`jose`) backed by PostgreSQL so multi-user authentication and WebSocket authorization run end-to-end when an external Supabase project is not yet configured.
- All WebSocket connections (`/collab`, `/ws/events`, `/ws/terminal`) require a valid JWT and verify `WorkspaceMember` permissions on the backend.
- `VIEWER` role connections are marked `readOnly = true` at the Hocuspocus protocol level and blocked from mutating files, invoking execution, or opening terminals.

## 4. Real-Time Collaboration Architecture

- Each file gets an isolated Yjs document named `workspace:{workspaceId}:file:{fileId}`.
- `Hocuspocus` enforces document naming regex + workspace membership before loading or mutating any document.
- Document binary states (`Uint8Array`) are persisted in `CollabDocument.state` and synced to `WorkspaceFile.contentSnapshot` on store/debounce.
- `y-monaco` binds `Y.Text('monaco')` to Monaco Editor with per-user deterministic cursor colors via Yjs Awareness.

## 5. Browser & Hosted Execution Architecture

- **JavaScript / TypeScript**: Executed client-side inside `@webcontainer/api` (requires COOP `same-origin` + COEP `credentialless` headers, configured in `vite.config.ts` and deployment headers).
- **Python**: Executed client-side inside an isolated Pyodide Web Worker with stdout/stderr capture and worker termination timeout.
- **C / C++ / Java / Go / Rust / PHP**: Executed via the backend `ExecutionProxyService` forwarding to a configured hosted sandbox API (e.g., Piston v2), with strict input/output caps, rate limiting, and audit logging.

