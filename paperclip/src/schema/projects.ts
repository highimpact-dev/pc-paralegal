import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";
import { goals } from "./goals.js";
import { agents } from "./agents.js";

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id),
    goalId: text("goal_id").references(() => goals.id),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("backlog"),
    leadAgentId: text("lead_agent_id").references(() => agents.id),
    targetDate: text("target_date"),
    color: text("color"),
    executionWorkspacePolicy: text("execution_workspace_policy", { mode: "json" }).$type<Record<string, unknown>>(),
    archivedAt: text("archived_at"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    companyIdx: index("projects_company_idx").on(table.companyId),
  }),
);
