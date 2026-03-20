import { sqliteTable, text, real, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const agentMemories = sqliteTable(
  "agent_memories",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id),
    agentId: text("agent_id").references(() => agents.id),
    namespace: text("namespace").notNull().default("default"),
    type: text("type").notNull(),
    content: text("content").notNull(),
    title: text("title"),
    importance: real("importance").notNull().default(0.5),
    concepts: text("concepts", { mode: "json" }).$type<string[]>(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
    archivedAt: text("archived_at"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    companyAgentIdx: index("agent_memories_company_agent_idx").on(table.companyId, table.agentId),
    companyNamespaceIdx: index("agent_memories_company_namespace_idx").on(table.companyId, table.namespace),
    typeIdx: index("agent_memories_type_idx").on(table.type),
    importanceIdx: index("agent_memories_importance_idx").on(table.importance),
  }),
);
