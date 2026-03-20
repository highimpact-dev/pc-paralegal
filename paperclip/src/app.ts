import express from "express";
import cors from "cors";
import { eq } from "drizzle-orm";
import { companies } from "./schema/companies.js";
import { agents } from "./schema/agents.js";
import { projects } from "./schema/projects.js";
import { issues } from "./schema/issues.js";
import { issueComments } from "./schema/issue_comments.js";
import { activityLog } from "./schema/activity_log.js";
import { heartbeatRuns } from "./schema/heartbeat_runs.js";
import { agentMemories } from "./schema/agent_memories.js";
import type { AppDb } from "./db.js";

export function createApp(db: AppDb) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", version: "0.1.0", mode: "local_trusted" });
  });

  // --- Companies ---
  app.get("/api/companies", async (_req, res) => {
    const rows = await db.select().from(companies);
    res.json({ companies: rows });
  });

  app.get("/api/companies/:id", async (req, res) => {
    const rows = await db.select().from(companies).where(eq(companies.id, req.params.id));
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  });

  // --- Agents ---
  app.get("/api/companies/:companyId/agents", async (req, res) => {
    const rows = await db.select().from(agents).where(eq(agents.companyId, req.params.companyId));
    res.json({ agents: rows });
  });

  app.get("/api/agents/:id", async (req, res) => {
    const rows = await db.select().from(agents).where(eq(agents.id, req.params.id));
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  });

  // --- Projects ---
  app.get("/api/companies/:companyId/projects", async (req, res) => {
    const rows = await db.select().from(projects).where(eq(projects.companyId, req.params.companyId));
    res.json({ projects: rows });
  });

  // --- Issues ---
  app.get("/api/companies/:companyId/projects/:projectId/issues", async (req, res) => {
    const rows = await db.select().from(issues).where(eq(issues.projectId, req.params.projectId));
    res.json({ issues: rows });
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
      status: "backlog",
      priority: req.body.priority || "medium",
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(issues).values(issue);
    res.status(201).json(issue);
  });

  app.patch("/api/issues/:id", async (req, res) => {
    const { id } = req.params;
    await db.update(issues).set({ ...req.body, updatedAt: new Date().toISOString() }).where(eq(issues.id, id));
    const rows = await db.select().from(issues).where(eq(issues.id, id));
    res.json(rows[0]);
  });

  // --- Issue Comments ---
  app.get("/api/issues/:issueId/comments", async (req, res) => {
    const rows = await db.select().from(issueComments).where(eq(issueComments.issueId, req.params.issueId));
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

  // --- Activity Log ---
  app.get("/api/companies/:companyId/activity", async (req, res) => {
    const rows = await db.select().from(activityLog).where(eq(activityLog.companyId, req.params.companyId));
    res.json({ activity: rows });
  });

  // --- Agent Memories ---
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

  // --- Heartbeat Runs ---
  app.get("/api/companies/:companyId/agents/:agentId/runs", async (req, res) => {
    const rows = await db.select().from(heartbeatRuns).where(eq(heartbeatRuns.agentId, req.params.agentId));
    res.json({ runs: rows });
  });

  // Catch-all for unknown API routes
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}
