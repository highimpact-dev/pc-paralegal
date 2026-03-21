import express from "express";
import cors from "cors";
import { eq, desc } from "drizzle-orm";
import { companies } from "./schema/companies.js";
import { agents } from "./schema/agents.js";
import { projects } from "./schema/projects.js";
import { issues } from "./schema/issues.js";
import { issueComments } from "./schema/issue_comments.js";
import { activityLog } from "./schema/activity_log.js";
import { heartbeatRuns } from "./schema/heartbeat_runs.js";
import { agentMemories } from "./schema/agent_memories.js";
import type { AppDb } from "./db.js";
import type { Database } from "bun:sqlite";
import { createAuthRoutes, getSessionUser } from "./auth.js";

function logActivity(db: AppDb, companyId: string, action: string, entityType: string, entityId: string, actorType = "user", actorId: string | null = null, details: unknown = null) {
  return db.insert(activityLog).values({
    id: crypto.randomUUID(),
    companyId,
    actorType,
    actorId,
    action,
    entityType,
    entityId,
    details: details ? JSON.stringify(details) : null,
    createdAt: new Date().toISOString(),
  });
}

export function createApp(db: AppDb, sqlite: Database) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  // Health check (no auth required)
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", version: "0.1.0", mode: "authenticated" });
  });

  // Auth routes (no session required — they handle their own auth logic)
  app.use(createAuthRoutes(db, sqlite));

  // Auth middleware — all subsequent /api/* routes require a valid session
  app.use("/api", (req, res, next) => {
    const user = getSessionUser(sqlite, req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    res.locals["user"] = user;
    return next();
  });

  // ==================== Companies ====================
  app.get("/api/companies", async (_req, res) => {
    const rows = await db.select().from(companies);
    res.json({ companies: rows });
  });

  app.get("/api/companies/:id", async (req, res) => {
    const rows = await db.select().from(companies).where(eq(companies.id, req.params.id));
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  });

  // ==================== Agents ====================
  app.get("/api/companies/:companyId/agents", async (req, res) => {
    const rows = await db.select().from(agents).where(eq(agents.companyId, req.params.companyId));
    res.json({ agents: rows });
  });

  app.get("/api/agents/:id", async (req, res) => {
    const rows = await db.select().from(agents).where(eq(agents.id, req.params.id));
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  });

  app.post("/api/companies/:companyId/agents", async (req, res) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const agent = {
      id,
      companyId: req.params.companyId,
      name: req.body.name,
      role: req.body.role || "general",
      title: req.body.title || null,
      capabilities: req.body.capabilities || null,
      adapterType: req.body.adapterType || "process",
      status: "idle",
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(agents).values(agent);
    await logActivity(db, req.params.companyId, "created", "agent", id, "user", null, { name: agent.name });
    res.status(201).json(agent);
  });

  app.patch("/api/agents/:id", async (req, res) => {
    const { id } = req.params;
    const existing = await db.select().from(agents).where(eq(agents.id, id));
    if (existing.length === 0) return res.status(404).json({ error: "Not found" });
    await db.update(agents).set({ ...req.body, updatedAt: new Date().toISOString() }).where(eq(agents.id, id));
    const updated = await db.select().from(agents).where(eq(agents.id, id));
    await logActivity(db, existing[0].companyId, "updated", "agent", id, "user", null, req.body);
    res.json(updated[0]);
  });

  app.delete("/api/agents/:id", async (req, res) => {
    const existing = await db.select().from(agents).where(eq(agents.id, req.params.id));
    if (existing.length === 0) return res.status(404).json({ error: "Not found" });
    await db.delete(agents).where(eq(agents.id, req.params.id));
    await logActivity(db, existing[0].companyId, "deleted", "agent", req.params.id, "user", null, { name: existing[0].name });
    res.json({ ok: true });
  });

  // ==================== Projects ====================
  app.get("/api/companies/:companyId/projects", async (req, res) => {
    const rows = await db.select().from(projects).where(eq(projects.companyId, req.params.companyId));
    res.json({ projects: rows });
  });

  app.post("/api/companies/:companyId/projects", async (req, res) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const project = {
      id,
      companyId: req.params.companyId,
      name: req.body.name,
      description: req.body.description || null,
      status: req.body.status || "active",
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(projects).values(project);
    await logActivity(db, req.params.companyId, "created", "project", id, "user", null, { name: project.name });
    res.status(201).json(project);
  });

  app.patch("/api/projects/:id", async (req, res) => {
    const { id } = req.params;
    const existing = await db.select().from(projects).where(eq(projects.id, id));
    if (existing.length === 0) return res.status(404).json({ error: "Not found" });
    await db.update(projects).set({ ...req.body, updatedAt: new Date().toISOString() }).where(eq(projects.id, id));
    const updated = await db.select().from(projects).where(eq(projects.id, id));
    res.json(updated[0]);
  });

  app.delete("/api/projects/:id", async (req, res) => {
    const existing = await db.select().from(projects).where(eq(projects.id, req.params.id));
    if (existing.length === 0) return res.status(404).json({ error: "Not found" });
    await db.delete(projects).where(eq(projects.id, req.params.id));
    res.json({ ok: true });
  });

  // ==================== Issues ====================
  app.get("/api/companies/:companyId/issues", async (req, res) => {
    const rows = await db.select().from(issues).where(eq(issues.companyId, req.params.companyId)).orderBy(desc(issues.createdAt));
    res.json({ issues: rows });
  });

  app.get("/api/companies/:companyId/projects/:projectId/issues", async (req, res) => {
    const rows = await db.select().from(issues).where(eq(issues.projectId, req.params.projectId)).orderBy(desc(issues.createdAt));
    res.json({ issues: rows });
  });

  app.get("/api/issues/:id", async (req, res) => {
    const rows = await db.select().from(issues).where(eq(issues.id, req.params.id));
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  });

  app.post("/api/companies/:companyId/projects/:projectId/issues", async (req, res) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const issue = {
      id,
      companyId: req.params.companyId,
      projectId: req.params.projectId,
      title: req.body.title,
      description: req.body.description || null,
      status: req.body.status || "backlog",
      priority: req.body.priority || "medium",
      assigneeAgentId: req.body.assigneeAgentId || null,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(issues).values(issue);
    await logActivity(db, req.params.companyId, "created", "issue", id, "user", null, { title: issue.title });
    res.status(201).json(issue);
  });

  app.patch("/api/issues/:id", async (req, res) => {
    const { id } = req.params;
    const existing = await db.select().from(issues).where(eq(issues.id, id));
    if (existing.length === 0) return res.status(404).json({ error: "Not found" });
    await db.update(issues).set({ ...req.body, updatedAt: new Date().toISOString() }).where(eq(issues.id, id));
    const updated = await db.select().from(issues).where(eq(issues.id, id));
    if (req.body.status && req.body.status !== existing[0].status) {
      await logActivity(db, existing[0].companyId, "status_changed", "issue", id, "user", null, { from: existing[0].status, to: req.body.status });
    }
    res.json(updated[0]);
  });

  app.delete("/api/issues/:id", async (req, res) => {
    const existing = await db.select().from(issues).where(eq(issues.id, req.params.id));
    if (existing.length === 0) return res.status(404).json({ error: "Not found" });
    await db.delete(issues).where(eq(issues.id, req.params.id));
    res.json({ ok: true });
  });

  // ==================== Issue Comments ====================
  app.get("/api/issues/:issueId/comments", async (req, res) => {
    const rows = await db.select().from(issueComments).where(eq(issueComments.issueId, req.params.issueId)).orderBy(issueComments.createdAt);
    res.json({ comments: rows });
  });

  app.post("/api/issues/:issueId/comments", async (req, res) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const comment = {
      id,
      companyId: req.body.companyId,
      issueId: req.params.issueId,
      authorAgentId: req.body.authorAgentId || null,
      authorUserId: req.body.authorUserId || null,
      body: req.body.body,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(issueComments).values(comment);
    res.status(201).json(comment);
  });

  // ==================== Activity Log ====================
  app.get("/api/companies/:companyId/activity", async (req, res) => {
    const rows = await db.select().from(activityLog).where(eq(activityLog.companyId, req.params.companyId)).orderBy(desc(activityLog.createdAt)).limit(100);
    res.json({ activity: rows });
  });

  // ==================== Agent Memories ====================
  app.get("/api/companies/:companyId/memories", async (req, res) => {
    const rows = await db.select().from(agentMemories).where(eq(agentMemories.companyId, req.params.companyId));
    res.json({ memories: rows });
  });

  app.post("/api/companies/:companyId/memories", async (req, res) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const memory = {
      id,
      companyId: req.params.companyId,
      agentId: req.body.agentId || null,
      namespace: req.body.namespace || "default",
      type: req.body.type,
      content: req.body.content,
      title: req.body.title || null,
      importance: req.body.importance || 0.5,
      concepts: req.body.concepts ? JSON.stringify(req.body.concepts) : null,
      metadata: req.body.metadata ? JSON.stringify(req.body.metadata) : null,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(agentMemories).values(memory);
    res.status(201).json(memory);
  });

  // ==================== Heartbeat Runs ====================
  app.get("/api/companies/:companyId/agents/:agentId/runs", async (req, res) => {
    const rows = await db.select().from(heartbeatRuns).where(eq(heartbeatRuns.agentId, req.params.agentId)).orderBy(desc(heartbeatRuns.createdAt));
    res.json({ runs: rows });
  });

  // Catch-all for unknown API routes
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}
