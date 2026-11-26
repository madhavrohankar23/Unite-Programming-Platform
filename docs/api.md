# Unite — REST & WebSocket API Reference

## REST Endpoints (`/api`)

All protected routes require `Authorization: Bearer <token>`.

### Health
- `GET /api/health` — Returns service status, active auth provider, storage driver, and hosted execution availability.

### Authentication
- `POST /api/auth/register` — Register user in `local` auth mode (`email`, `password`, `displayName`).
- `POST /api/auth/login` — Authenticate in `local` auth mode (`email`, `password`).
- `GET /api/auth/me` — Return authenticated `UserProfileDto` (works in both `supabase` and `local` modes).
- `PATCH /api/auth/me` — Update `displayName` or `avatarUrl`.

### Workspaces & Membership
- `GET /api/workspaces` — List workspaces for the authenticated user.
- `POST /api/workspaces` — Create workspace (`name`, `defaultLanguage`, `template`). Returns `{ workspace, initialInvitation }`.
- `GET /api/workspaces/:workspaceId` — Fetch workspace metadata, members, and file tree (requires membership).
- `PATCH /api/workspaces/:workspaceId` — Update workspace name or default language (`OWNER` only).
- `DELETE /api/workspaces/:workspaceId` — Delete workspace (`OWNER` only).
- `GET /api/workspaces/:workspaceId/members` — List workspace members.
- `PATCH /api/workspaces/:workspaceId/members/:userId` — Update member role (`OWNER` only).
- `DELETE /api/workspaces/:workspaceId/members/:userId` — Remove member (`OWNER` only).
- `POST /api/workspaces/:workspaceId/leave` — Leave workspace (non-owners).

### Invitations
- `POST /api/workspaces/:workspaceId/invitations` — Generate invitation (`EDITOR` or `VIEWER`).
- `GET /api/workspaces/:workspaceId/invitations` — List invitations (`EDITOR`/`OWNER`).
- `DELETE /api/workspaces/:workspaceId/invitations/:invitationId` — Revoke invitation (`EDITOR`/`OWNER`).
- `POST /api/invitations/validate` — Validate an invitation link or code without joining.
- `POST /api/invitations/join` — Join workspace using an invitation link or code.

### Files & Folders
- `GET /api/workspaces/:workspaceId/files` — List all file and folder nodes.
- `POST /api/workspaces/:workspaceId/files` — Create file or folder (`OWNER`/`EDITOR`).
- `PATCH /api/workspaces/:workspaceId/files/:fileId` — Rename, move, or update language (`OWNER`/`EDITOR`).
- `DELETE /api/workspaces/:workspaceId/files/:fileId` — Delete file or recursive folder subtree (`OWNER`/`EDITOR`).

### Code Execution
- `POST /api/workspaces/:workspaceId/execute` — Execute C, C++, Java, Go, Rust, or PHP via configured hosted sandbox (`OWNER`/`EDITOR`).
- `POST /api/workspaces/:workspaceId/executions/record` — Record client-side sandbox execution (`WebContainer`/`Pyodide`) to workspace history.
- `GET /api/workspaces/:workspaceId/executions` — List recent execution records.

## WebSocket Endpoints
- `/collab` — Hocuspocus Yjs collaboration endpoint. Document format: `workspace:{workspaceId}:file:{fileId}`. Authenticates JWT and enforces `readOnly` for `VIEWER`.
- `/ws/events?workspaceId=...&token=...` — Real-time workspace file tree, membership, and chat events.
- `/ws/terminal?workspaceId=...&token=...` — Authenticated terminal gateway (`OWNER`/`EDITOR` only).

