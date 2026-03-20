import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";
import { projects } from "./projects.js";

export const projectWorkspaces = sqliteTable(
  "project_workspaces",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    cwd: text("cwd"),
    repoUrl: text("repo_url"),
    repoRef: text("repo_ref"),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    companyProjectIdx: index("project_workspaces_company_project_idx").on(table.companyId, table.projectId),
    projectPrimaryIdx: index("project_workspaces_project_primary_idx").on(table.projectId, table.isPrimary),
  }),
);
