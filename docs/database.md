# Unite — Database Schema & Persistence

Unite uses **PostgreSQL** via **Prisma ORM** (`prisma/schema.prisma`) in production (Supabase PostgreSQL) and **PGlite** (`@electric-sql/pglite`) for zero-config persistent local PostgreSQL development.

## Entities
- **UserProfile**: User identity mapped to Supabase `authUserId`, email, display name, and avatar URL.
- **Workspace**: Collaborative project root owned by a `UserProfile`.
- **WorkspaceMember**: Joins users to workspaces with `OWNER`, `EDITOR`, or `VIEWER` roles.
- **WorkspaceInvitation**: Stores SHA-256 `tokenHash`, readable `codePrefix`, role, expiration, usage limit, and revocation timestamp.
- **WorkspaceFile**: Hierarchical file/folder metadata (`parentId`, `nodeType`, `language`, `contentSnapshot`) using stable IDs (`fil_...`, `fld_...`).
- **CollabDocument**: Stores binary Yjs CRDT state (`BYTEA`) keyed by `workspace:{workspaceId}:file:{fileId}` separately from file metadata.
- **ExecutionRecord**: Audit trail of code executions (`language`, `provider`, `status`, `exitCode`, `stdout`, `stderr`, `durationMs`).
- **AuditLog**: Security audit log for registrations, workspace changes, invitations, member updates, file deletions, and executions.

