# Unite — Setup & Deployment Guide

## Prerequisites
- **Node.js 20+** and **npm 10+**
- Optional for production:
  - **Supabase project** (PostgreSQL + Supabase Auth)
  - **Hosted Execution API** (Piston v2 compatible endpoint for C/C++/Java/Go/Rust/PHP)
  - **Vercel** (frontend) + **Render / Railway / Fly.io** (persistent Node.js backend + WebSockets)

## 1. Local Development (Zero-Config Persistent Mode)

```bash
npm install
npm run prisma:generate
cp .env.example .env
npm run dev
```

- Frontend runs at `http://localhost:5173` (with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` for WebContainers).
- Backend + Hocuspocus + WebSocket server runs at `http://localhost:4000`.
- Local database persists automatically to `.unite-data/pgdata` via embedded PostgreSQL (`STORAGE_DRIVER=pglite`).

## 2. Production Configuration (Supabase + Vercel + Node Hosting)

### Database & Auth (Supabase)
1. Create a Supabase project.
2. Copy your PostgreSQL connection string into `DATABASE_URL` and set `STORAGE_DRIVER=prisma`.
3. Run Prisma migrations:
   ```bash
   npm run prisma:deploy
   ```
4. Set `AUTH_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_JWT_SECRET` on the backend.
5. Set `VITE_AUTH_MODE=supabase`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` on the frontend.

### Frontend Deployment (Vercel)
- Build command: `npm run build:web`
- Output directory: `dist`
- Included `vercel.json` automatically configures SPA rewrites and COOP/COEP headers required for browser WebContainers.
- Configure `VITE_API_URL`, `VITE_COLLAB_WS_URL`, `VITE_EVENTS_WS_URL`, and `VITE_TERMINAL_WS_URL` to point to your deployed Node.js backend (`https://...` / `wss://...`).

### Backend & Collaboration Server Deployment (Persistent Node.js Host)
Deploy `server/` to a host that supports persistent WebSocket connections (Render, Railway, Fly.io, or a VPS — **do not** deploy `/collab` or `/ws/*` as short-lived serverless functions):
- Build command: `npm install && npm run prisma:generate && npm run build:server`
- Start command: `npm --workspace=server run start`
- Set `CLIENT_ORIGIN` to your frontend domain (e.g. `https://unite.example.com`).

## 3. Running Automated Tests & Verification
```bash
npm run typecheck
npm run lint
npm test
npm run build
```

