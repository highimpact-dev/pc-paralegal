import { join } from "path";
import { createDb } from "./db.js";
import { createApp } from "./app.js";
// seed.ts is no longer auto-run; setup happens via POST /api/auth/setup

const PORT = parseInt(process.env.PORT || "3101", 10);
const DATABASE_PATH = process.env.DATABASE_PATH || join(
  process.env.HOME || "/tmp",
  "paralegal/data/paperclip.db"
);

console.log(`[paperclip] Starting...`);
console.log(`[paperclip] Database: ${DATABASE_PATH}`);
console.log(`[paperclip] Port: ${PORT}`);

// Initialize database
const { db, sqlite } = createDb(DATABASE_PATH);

// Create all tables (push schema to DB)
// In production, use proper migrations. For POC, we push directly.
const { migrate } = await import("drizzle-orm/bun-sqlite/migrator");
try {
  // Try migrations first
  migrate(db, { migrationsFolder: join(import.meta.dir, "../migrations") });
} catch {
  // If no migrations exist yet, create tables from schema directly
  console.log("[paperclip] No migrations found, creating tables from schema...");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      issue_prefix TEXT UNIQUE,
      issue_counter INTEGER NOT NULL DEFAULT 0,
      budget_monthly_cents INTEGER,
      spent_monthly_cents INTEGER,
      require_board_approval_for_new_agents INTEGER NOT NULL DEFAULT 1,
      brand_color TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'general',
      title TEXT,
      icon TEXT,
      status TEXT NOT NULL DEFAULT 'idle',
      reports_to TEXT,
      capabilities TEXT,
      adapter_type TEXT NOT NULL DEFAULT 'process',
      adapter_config TEXT NOT NULL DEFAULT '{}',
      runtime_config TEXT NOT NULL DEFAULT '{}',
      permissions TEXT NOT NULL DEFAULT '{}',
      budget_monthly_cents INTEGER,
      spent_monthly_cents INTEGER,
      last_heartbeat_at TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      goal_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'backlog',
      lead_agent_id TEXT,
      target_date TEXT,
      color TEXT,
      execution_workspace_policy TEXT,
      archived_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      project_id TEXT REFERENCES projects(id),
      goal_id TEXT,
      parent_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'backlog',
      priority TEXT NOT NULL DEFAULT 'medium',
      assignee_agent_id TEXT,
      assignee_user_id TEXT,
      checkout_run_id TEXT,
      execution_run_id TEXT,
      execution_agent_name_key TEXT,
      execution_locked_at TEXT,
      created_by_agent_id TEXT,
      created_by_user_id TEXT,
      issue_number INTEGER,
      identifier TEXT UNIQUE,
      request_depth INTEGER NOT NULL DEFAULT 0,
      billing_code TEXT,
      assignee_adapter_overrides TEXT,
      execution_workspace_settings TEXT,
      started_at TEXT,
      completed_at TEXT,
      cancelled_at TEXT,
      hidden_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS issue_comments (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      issue_id TEXT NOT NULL REFERENCES issues(id),
      author_agent_id TEXT,
      author_user_id TEXT,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      actor_type TEXT NOT NULL DEFAULT 'system',
      actor_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      agent_id TEXT,
      run_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS heartbeat_runs (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      agent_id TEXT NOT NULL REFERENCES agents(id),
      invocation_source TEXT NOT NULL DEFAULT 'on_demand',
      trigger_detail TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      started_at TEXT,
      finished_at TEXT,
      error TEXT,
      exit_code INTEGER,
      signal TEXT,
      usage_json TEXT,
      result_json TEXT,
      stdout_excerpt TEXT,
      stderr_excerpt TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS agent_memories (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      agent_id TEXT,
      namespace TEXT NOT NULL DEFAULT 'default',
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      title TEXT,
      importance REAL NOT NULL DEFAULT 0.5,
      concepts TEXT,
      metadata TEXT,
      archived_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'paralegal',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  console.log("[paperclip] Core tables created.");
}

// Start server (setup/seeding now happens via POST /api/auth/setup on first launch)
const app = createApp(db, sqlite);
app.listen(PORT, () => {
  console.log(`[paperclip] Server running at http://localhost:${PORT}`);
});
