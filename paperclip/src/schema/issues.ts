import { type AnySQLiteColumn, sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { agents } from "./agents.js";
import { projects } from "./projects.js";
import { goals } from "./goals.js";
import { companies } from "./companies.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

export const issues = sqliteTable(
  "issues",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id),
    projectId: text("project_id").references(() => projects.id),
    goalId: text("goal_id").references(() => goals.id),
    parentId: text("parent_id").references((): AnySQLiteColumn => issues.id),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("backlog"),
    priority: text("priority").notNull().default("medium"),
    assigneeAgentId: text("assignee_agent_id").references(() => agents.id),
    assigneeUserId: text("assignee_user_id"),
    checkoutRunId: text("checkout_run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    executionRunId: text("execution_run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    executionAgentNameKey: text("execution_agent_name_key"),
    executionLockedAt: text("execution_locked_at"),
    createdByAgentId: text("created_by_agent_id").references(() => agents.id),
    createdByUserId: text("created_by_user_id"),
    issueNumber: integer("issue_number"),
    identifier: text("identifier"),
    requestDepth: integer("request_depth").notNull().default(0),
    billingCode: text("billing_code"),
    assigneeAdapterOverrides: text("assignee_adapter_overrides", { mode: "json" }).$type<Record<string, unknown>>(),
    executionWorkspaceSettings: text("execution_workspace_settings", { mode: "json" }).$type<Record<string, unknown>>(),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    cancelledAt: text("cancelled_at"),
    hiddenAt: text("hidden_at"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    companyStatusIdx: index("issues_company_status_idx").on(table.companyId, table.status),
    assigneeStatusIdx: index("issues_company_assignee_status_idx").on(
      table.companyId,
      table.assigneeAgentId,
      table.status,
    ),
    assigneeUserStatusIdx: index("issues_company_assignee_user_status_idx").on(
      table.companyId,
      table.assigneeUserId,
      table.status,
    ),
    parentIdx: index("issues_company_parent_idx").on(table.companyId, table.parentId),
    projectIdx: index("issues_company_project_idx").on(table.companyId, table.projectId),
    identifierIdx: uniqueIndex("issues_identifier_idx").on(table.identifier),
  }),
);
