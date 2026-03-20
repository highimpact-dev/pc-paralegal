# Step: Add Authentication - Completed

## What I Built

Added session-based authentication to the pc-paralegal Paperclip server. This includes `users` and `sessions` tables (DDL in the inline schema fallback), a full auth routes module (`auth.ts`) with 8 endpoints, and an Express middleware that guards all non-auth API routes behind a valid Bearer session token.

## Files Changed

| File | Changes |
|------|---------|
| `src/index.ts` | Added `users` and `sessions` CREATE TABLE DDL to the sqlite.exec block; changed `createApp(db)` to `createApp(db, sqlite)` |
| `src/auth.ts` | Created — exports `createAuthRoutes(db, sqlite)` router and `getSessionUser(sqlite, req)` helper |
| `src/app.ts` | Added `Database` import and auth imports; `createApp` now accepts `sqlite` second param; mounts auth router before auth middleware; auth middleware guards all subsequent `/api/*` routes via `res.locals.user` |

## Verification

- [x] `bun run src/index.ts` — server starts clean, tables created
- [x] `GET /api/health` — returns `{ mode: "authenticated" }` (no auth required)
- [x] `GET /api/auth/setup-status` — returns `{ needsSetup: true, userCount: 0 }` (no auth required)
- [x] `GET /api/companies` without token — returns `401 Unauthorized`
- [x] `POST /api/auth/register` (first user) — assigns `admin` role automatically, no session required
- [x] `POST /api/auth/login` — returns session token, no password_hash in response
- [x] `GET /api/auth/me` with token — returns user `{ id, name, email, role }`
- [x] `GET /api/companies` with token — returns data (auth passes through)
- [x] `POST /api/auth/logout` — deletes session, returns `{ ok: true }`
- [x] `GET /api/auth/me` after logout — returns `401`

## Self-Review

- Completeness: All requirements met — all 8 auth endpoints, auth middleware, table DDL, sqlite passthrough, first-user-is-admin logic, 30-day expiry, never-return-password_hash
- Scope: Clean — only the three files listed above were modified/created
- Quality: Clean — raw SQL via sqlite instance as specified, Bun.password for hashing, UUID session tokens

## Deviations from Spec

None.

## Learnings

- The project doesn't have `@types/bun` installed, so `tsc --noEmit` reports type errors on `Bun.*` and `bun:sqlite` imports project-wide (pre-existing in `db.ts`, not introduced by this task). Runtime with `bun` works correctly.
- `(db as any).$client` was not needed — the spec's simpler approach of accepting `sqlite` as a second parameter was used throughout.

## Concerns

Adding `@types/bun` to devDependencies would eliminate the TypeScript type errors across the whole project. Not in scope for this task.
