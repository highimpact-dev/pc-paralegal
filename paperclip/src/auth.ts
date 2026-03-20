import { Router } from "express";
import type { Request } from "express";
import type { Database } from "bun:sqlite";
import type { AppDb } from "./db.js";

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: string;
  updated_at: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export function getSessionUser(sqlite: Database, req: Request): UserRow | null {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const session = sqlite.query<SessionRow, [string]>(
    "SELECT * FROM sessions WHERE token = ?"
  ).get(token);

  if (!session) return null;

  if (new Date(session.expires_at) < new Date()) {
    sqlite.query("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }

  const user = sqlite.query<UserRow, [string]>(
    "SELECT * FROM users WHERE id = ?"
  ).get(session.user_id);

  return user ?? null;
}

export function createAuthRoutes(_db: AppDb, sqlite: Database): Router {
  const router = Router();

  // GET /api/auth/setup-status
  router.get("/api/auth/setup-status", (_req, res) => {
    const row = sqlite.query<{ count: number }, []>(
      "SELECT COUNT(*) as count FROM users"
    ).get();
    const userCount = row?.count ?? 0;
    res.json({ needsSetup: userCount === 0, userCount });
  });

  // POST /api/auth/setup - First launch: create admin + company + project + agents
  router.post("/api/auth/setup", async (req, res) => {
    const { name, email, password, companyName } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      companyName?: string;
    };

    if (!name || !email || !password || !companyName) {
      return res.status(400).json({ error: "name, email, password, and companyName are required" });
    }

    const countRow = sqlite.query<{ count: number }, []>(
      "SELECT COUNT(*) as count FROM users"
    ).get();
    if ((countRow?.count ?? 0) > 0) {
      return res.status(400).json({ error: "Setup already completed" });
    }

    // Create admin user
    const passwordHash = await Bun.password.hash(password);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    sqlite.query(
      "INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(userId, name, email, passwordHash, "admin", now, now);

    // Create company
    const companyId = crypto.randomUUID();
    const prefix = companyName.slice(0, 3).toUpperCase();
    sqlite.query(
      "INSERT INTO companies (id, name, issue_prefix, status, issue_counter, require_board_approval_for_new_agents, created_at, updated_at) VALUES (?, ?, ?, 'active', 0, 0, ?, ?)"
    ).run(companyId, companyName, prefix, now, now);

    // Create default project
    const projectId = crypto.randomUUID();
    sqlite.query(
      "INSERT INTO projects (id, company_id, name, status, created_at, updated_at) VALUES (?, ?, 'Cases', 'active', ?, ?)"
    ).run(projectId, companyId, now, now);

    // Create default agents
    const agentDefs = [
      { name: "Director", role: "orchestrator", title: "Paralegal Director", caps: "task_decomposition,delegation,review" },
      { name: "Reviewer", role: "analyst", title: "Document Reviewer", caps: "document_analysis,risk_assessment,clause_review" },
      { name: "Drafter", role: "writer", title: "Document Drafter", caps: "memo_writing,summarization,checklist_creation" },
    ];
    for (const def of agentDefs) {
      sqlite.query(
        "INSERT INTO agents (id, company_id, name, role, title, capabilities, adapter_type, status, adapter_config, runtime_config, permissions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'process', 'idle', '{}', '{}', '{}', ?, ?)"
      ).run(crypto.randomUUID(), companyId, def.name, def.role, def.title, def.caps, now, now);
    }

    // Auto-login: create session
    const token = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    sqlite.query(
      "INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(sessionId, userId, token, expiresAt, now);

    return res.status(201).json({
      token,
      user: { id: userId, name, email, role: "admin" },
      company: { id: companyId, name: companyName, prefix },
    });
  });

  // POST /api/auth/register
  router.post("/api/auth/register", async (req, res) => {
    const { name, email, password, role } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
    };

    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email, and password are required" });
    }

    const countRow = sqlite.query<{ count: number }, []>(
      "SELECT COUNT(*) as count FROM users"
    ).get();
    const userCount = countRow?.count ?? 0;

    let assignedRole: string;
    if (userCount === 0) {
      assignedRole = "admin";
    } else {
      const requestingUser = getSessionUser(sqlite, req);
      if (!requestingUser) {
        return res.status(403).json({ error: "Authentication required to create users" });
      }
      if (requestingUser.role !== "admin") {
        return res.status(403).json({ error: "Only admins can create users" });
      }
      const validRoles = ["admin", "paralegal", "viewer"];
      assignedRole = role && validRoles.includes(role) ? role : "paralegal";
    }

    const existing = sqlite.query<{ id: string }, [string]>(
      "SELECT id FROM users WHERE email = ?"
    ).get(email);
    if (existing) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const passwordHash = await Bun.password.hash(password);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    sqlite.query(
      "INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, name, email, passwordHash, assignedRole, now, now);

    return res.status(201).json({ id, name, email, role: assignedRole });
  });

  // POST /api/auth/login
  router.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = sqlite.query<UserRow, [string]>(
      "SELECT * FROM users WHERE email = ?"
    ).get(email);

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await Bun.password.verify(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    sqlite.query(
      "INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(sessionId, user.id, token, expiresAt, now);

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  });

  // POST /api/auth/logout
  router.post("/api/auth/logout", (req, res) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization header required" });
    }
    const token = authHeader.slice(7).trim();
    sqlite.query("DELETE FROM sessions WHERE token = ?").run(token);
    return res.json({ ok: true });
  });

  // GET /api/auth/me
  router.get("/api/auth/me", (req, res) => {
    const user = getSessionUser(sqlite, req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    return res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  });

  // GET /api/auth/users (admin only)
  router.get("/api/auth/users", (req, res) => {
    const requestingUser = getSessionUser(sqlite, req);
    if (!requestingUser) return res.status(401).json({ error: "Unauthorized" });
    if (requestingUser.role !== "admin") return res.status(403).json({ error: "Admin required" });

    const rows = sqlite.query<Omit<UserRow, "password_hash">, []>(
      "SELECT id, name, email, role, created_at, updated_at FROM users"
    ).all();
    return res.json({ users: rows });
  });

  // DELETE /api/auth/users/:id (admin only)
  router.delete("/api/auth/users/:id", (req, res) => {
    const requestingUser = getSessionUser(sqlite, req);
    if (!requestingUser) return res.status(401).json({ error: "Unauthorized" });
    if (requestingUser.role !== "admin") return res.status(403).json({ error: "Admin required" });

    if (req.params.id === requestingUser.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const target = sqlite.query<{ id: string }, [string]>(
      "SELECT id FROM users WHERE id = ?"
    ).get(req.params.id);
    if (!target) return res.status(404).json({ error: "User not found" });

    sqlite.query("DELETE FROM users WHERE id = ?").run(req.params.id);
    return res.json({ ok: true });
  });

  // PATCH /api/auth/users/:id (admin only)
  router.patch("/api/auth/users/:id", (req, res) => {
    const requestingUser = getSessionUser(sqlite, req);
    if (!requestingUser) return res.status(401).json({ error: "Unauthorized" });
    if (requestingUser.role !== "admin") return res.status(403).json({ error: "Admin required" });

    const { role } = req.body as { role?: string };
    const validRoles = ["admin", "paralegal", "viewer"];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ error: "role must be one of: admin, paralegal, viewer" });
    }

    const target = sqlite.query<UserRow, [string]>(
      "SELECT id FROM users WHERE id = ?"
    ).get(req.params.id);
    if (!target) return res.status(404).json({ error: "User not found" });

    const now = new Date().toISOString();
    sqlite.query("UPDATE users SET role = ?, updated_at = ? WHERE id = ?").run(role, now, req.params.id);

    const updated = sqlite.query<Omit<UserRow, "password_hash">, [string]>(
      "SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?"
    ).get(req.params.id);

    return res.json(updated);
  });

  return router;
}
