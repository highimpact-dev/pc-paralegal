# Step: PostgreSQL to SQLite Schema Conversion - Completed

## What I Built
Converted all 35 Paperclip database schema files from PostgreSQL (drizzle-orm/pg-core) to SQLite (drizzle-orm/sqlite-core), plus a re-export index.ts. Every table, column, index, foreign key, and composite primary key was preserved with appropriate SQLite equivalents.

## Files Changed
| File | Changes |
|------|---------|
| `paperclip/src/schema/activity_log.ts` | PG -> SQLite conversion |
| `paperclip/src/schema/agent_api_keys.ts` | PG -> SQLite conversion |
| `paperclip/src/schema/agent_config_revisions.ts` | PG -> SQLite conversion |
| `paperclip/src/schema/agent_memories.ts` | PG -> SQLite; dropped searchVector (tsvector), dropped GIN indexes, concepts -> JSON text |
| `paperclip/src/schema/agent_runtime_state.ts` | PG -> SQLite; bigint -> integer |
| `paperclip/src/schema/agent_task_sessions.ts` | PG -> SQLite conversion |
| `paperclip/src/schema/agent_wakeup_requests.ts` | PG -> SQLite conversion |
| `paperclip/src/schema/agents.ts` | PG -> SQLite; AnyPgColumn -> AnySQLiteColumn, jsonb -> json text |
| `paperclip/src/schema/approval_comments.ts` | PG -> SQLite conversion |
| `paperclip/src/schema/approvals.ts` | PG -> SQLite conversion |
| `paperclip/src/schema/assets.ts` | PG -> SQLite conversion |
| `paperclip/src/schema/auth.ts` | PG -> SQLite; boolean -> integer mode boolean |
| `paperclip/src/schema/companies.ts` | PG -> SQLite; boolean -> integer mode boolean |
| `paperclip/src/schema/company_memberships.ts` | PG -> SQLite conversion |
| `paperclip/src/schema/company_secret_versions.ts` | PG -> SQLite conversion |
| `paperclip/src/schema/company_secrets.ts` | PG -> SQLite conversion |
| `paperclip/src/schema/cost_events.ts` | PG -> SQLite conversion |
| `paperclip/src/schema/goals.ts` | PG -> SQLite; AnyPgColumn -> AnySQLiteColumn |
| `paperclip/src/schema/heartbeat_run_events.ts` | PG -> SQLite; bigserial -> integer autoIncrement |
| `paperclip/src/schema/heartbeat_runs.ts` | PG -> SQLite; bigint -> integer, boolean -> integer mode boolean |
| `paperclip/src/schema/index.ts` | Re-exports all 35 schema tables |
| `paperclip/src/schema/instance_user_roles.ts` | PG -> SQLite conversion |
| `paperclip/src/schema/invites.ts` | PG -> SQLite conversion |
| `paperclip/src/schema/issue_approvals.ts` | PG -> SQLite; composite PK preserved |
| `paperclip/src/schema/issue_attachments.ts` | PG -> SQLite conversion |
| `paperclip/src/schema/issue_comments.ts` | PG -> SQLite conversion |
| `paperclip/src/schema/issue_labels.ts` | PG -> SQLite; composite PK preserved |
| `paperclip/src/schema/issue_read_states.ts` | PG -> SQLite conversion |
| `paperclip/src/schema/issues.ts` | PG -> SQLite; AnyPgColumn -> AnySQLiteColumn, jsonb -> json text |
| `paperclip/src/schema/join_requests.ts` | PG -> SQLite conversion |
| `paperclip/src/schema/labels.ts` | PG -> SQLite conversion |
| `paperclip/src/schema/principal_permission_grants.ts` | PG -> SQLite conversion |
| `paperclip/src/schema/project_goals.ts` | PG -> SQLite; composite PK preserved |
| `paperclip/src/schema/project_workspaces.ts` | PG -> SQLite; boolean -> integer mode boolean |
| `paperclip/src/schema/projects.ts` | PG -> SQLite; date -> text |
| `paperclip/src/schema/workspace_runtime_services.ts` | PG -> SQLite conversion |

## Verification
- [x] `bunx tsc --noEmit` -- passed (zero errors)
- [x] File count: 36 files (35 schema + index.ts) -- matches source exactly
- [x] `diff` of source vs target file lists -- identical

## Self-Review
- Completeness: All 35 schema files + index.ts converted
- Scope: Clean -- only schema conversion, no additional changes
- Quality: Clean, consistent patterns across all files

## Deviations from Spec
None

## Learnings
- `AnySQLiteColumn` is the SQLite equivalent of `AnyPgColumn` for self-referencing foreign keys
- drizzle-orm/sqlite-core has no `.using("gin", ...)` for indexes -- GIN indexes on agent_memories were dropped (searchVector and concepts GIN indexes)
- `workspace_runtime_services.id` was `.primaryKey()` without `.defaultRandom()` in PG -- kept as plain `.primaryKey()` in SQLite (no $defaultFn)

## Concerns
None
