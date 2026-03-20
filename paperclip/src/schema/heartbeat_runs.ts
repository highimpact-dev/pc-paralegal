import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { agentWakeupRequests } from "./agent_wakeup_requests.js";

export const heartbeatRuns = sqliteTable(
  "heartbeat_runs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id),
    agentId: text("agent_id").notNull().references(() => agents.id),
    invocationSource: text("invocation_source").notNull().default("on_demand"),
    triggerDetail: text("trigger_detail"),
    status: text("status").notNull().default("queued"),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    error: text("error"),
    wakeupRequestId: text("wakeup_request_id").references(() => agentWakeupRequests.id),
    exitCode: integer("exit_code"),
    signal: text("signal"),
    usageJson: text("usage_json", { mode: "json" }).$type<Record<string, unknown>>(),
    resultJson: text("result_json", { mode: "json" }).$type<Record<string, unknown>>(),
    sessionIdBefore: text("session_id_before"),
    sessionIdAfter: text("session_id_after"),
    logStore: text("log_store"),
    logRef: text("log_ref"),
    logBytes: integer("log_bytes"),
    logSha256: text("log_sha256"),
    logCompressed: integer("log_compressed", { mode: "boolean" }).notNull().default(false),
    stdoutExcerpt: text("stdout_excerpt"),
    stderrExcerpt: text("stderr_excerpt"),
    errorCode: text("error_code"),
    externalRunId: text("external_run_id"),
    contextSnapshot: text("context_snapshot", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    companyAgentStartedIdx: index("heartbeat_runs_company_agent_started_idx").on(
      table.companyId,
      table.agentId,
      table.startedAt,
    ),
  }),
);
