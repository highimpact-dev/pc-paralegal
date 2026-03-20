import { eq, count } from "drizzle-orm";
import { companies } from "./schema/companies.js";
import { projects } from "./schema/projects.js";
import { agents } from "./schema/agents.js";
import type { AppDb } from "./db.js";

export async function seedIfEmpty(db: AppDb) {
  // Check if any companies exist
  const existing = await db.select({ n: count() }).from(companies);
  if (existing[0]?.n > 0) {
    console.log("[seed] Database already has data, skipping seed.");
    return;
  }

  console.log("[seed] Empty database detected, seeding...");

  // Create the Paralegal company
  const companyId = crypto.randomUUID();
  await db.insert(companies).values({
    id: companyId,
    name: "Paralegal",
    issuePrefix: "PLG",
    status: "active",
    issueCounter: 0,
    requireBoardApprovalForNewAgents: false,
  });
  console.log("[seed] Created company: Paralegal (PLG)");

  // Create the Cases project
  const projectId = crypto.randomUUID();
  await db.insert(projects).values({
    id: projectId,
    companyId,
    name: "Cases",
    status: "active",
  });
  console.log("[seed] Created project: Cases");

  // Create the three agents
  const agentDefs = [
    {
      name: "Director",
      role: "orchestrator",
      title: "Paralegal Director",
      capabilities: "task_decomposition,delegation,review",
    },
    {
      name: "Reviewer",
      role: "analyst",
      title: "Document Reviewer",
      capabilities: "document_analysis,risk_assessment,clause_review",
    },
    {
      name: "Drafter",
      role: "writer",
      title: "Document Drafter",
      capabilities: "memo_writing,summarization,checklist_creation",
    },
  ];

  for (const def of agentDefs) {
    await db.insert(agents).values({
      id: crypto.randomUUID(),
      companyId,
      name: def.name,
      role: def.role,
      title: def.title,
      capabilities: def.capabilities,
      adapterType: "process",
      status: "idle",
    });
    console.log(`[seed] Created agent: ${def.name} (${def.title})`);
  }

  console.log("[seed] Seed complete.");
}
