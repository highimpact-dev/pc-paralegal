import { useState, useEffect } from "react";
import { useAuth } from "../../lib/auth";

const API = "http://localhost:3101/api";

interface Agent {
  id: string;
  name: string;
  title: string | null;
  role: string;
  status: string;
  capabilities: string | null;
  adapterType: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  companyId: string;
}

interface Issue {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  identifier: string | null;
  assigneeAgentId: string | null;
  companyId: string;
  projectId: string | null;
  createdAt: string;
}

interface Comment {
  id: string;
  body: string;
  authorType: string;
  authorId: string | null;
  createdAt: string;
}

interface Props {
  companyId: string;
  projects: Project[];
  agents: Agent[];
  onRefresh: () => void;
}

interface NewIssueForm {
  title: string;
  description: string;
  projectId: string;
  priority: string;
  assigneeAgentId: string;
}

export default function IssuesTab({ companyId, projects, agents, onRefresh }: Props) {
  const { token } = useAuth();
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const [issues, setIssues] = useState<Issue[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [form, setForm] = useState<NewIssueForm>({
    title: "",
    description: "",
    projectId: projects[0]?.id ?? "",
    priority: "medium",
    assigneeAgentId: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadIssues();
  }, [companyId]);

  async function loadIssues() {
    const res = await fetch(`${API}/companies/${companyId}/issues`, { headers: authHeaders });
    const data = await res.json();
    setIssues(data.issues || []);
  }

  async function loadComments(issueId: string) {
    const res = await fetch(`${API}/issues/${issueId}/comments`, { headers: authHeaders });
    const data = await res.json();
    setComments((prev) => ({ ...prev, [issueId]: data.comments || [] }));
  }

  function handleExpand(issueId: string) {
    if (expandedId === issueId) {
      setExpandedId(null);
    } else {
      setExpandedId(issueId);
      if (!comments[issueId]) loadComments(issueId);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.projectId) return;
    setSubmitting(true);
    try {
      await fetch(`${API}/companies/${companyId}/projects/${form.projectId}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          priority: form.priority,
          assigneeAgentId: form.assigneeAgentId || null,
        }),
      });
      setForm({
        title: "",
        description: "",
        projectId: projects[0]?.id ?? "",
        priority: "medium",
        assigneeAgentId: "",
      });
      setShowForm(false);
      await loadIssues();
      onRefresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(issueId: string, status: string) {
    await fetch(`${API}/issues/${issueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ status }),
    });
    await loadIssues();
    onRefresh();
  }

  async function handleAddComment(issueId: string) {
    const body = commentInputs[issueId]?.trim();
    if (!body) return;
    await fetch(`${API}/issues/${issueId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ body, companyId }),
    });
    setCommentInputs((prev) => ({ ...prev, [issueId]: "" }));
    await loadComments(issueId);
  }

  async function handleDelete(issue: Issue) {
    if (!window.confirm(`Delete issue "${issue.title}"? This cannot be undone.`)) return;
    await fetch(`${API}/issues/${issue.id}`, { method: "DELETE", headers: authHeaders });
    if (expandedId === issue.id) setExpandedId(null);
    await loadIssues();
    onRefresh();
  }

  const agentMap = new Map(agents.map((a) => [a.id, a]));

  const filtered = issues.filter((issue) => {
    const matchStatus = statusFilter === "all" || issue.status === statusFilter;
    const matchPriority = priorityFilter === "all" || issue.priority === priorityFilter;
    return matchStatus && matchPriority;
  });

  return (
    <section className="border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface overflow-hidden">
      <div className="px-5 py-3 border-b dark:border-dark-border bg-gray-50 dark:bg-dark-card flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-semibold text-sm">Issues</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-2 py-1 border dark:border-dark-border rounded bg-white dark:bg-dark-card dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-accent/50"
          >
            <option value="all">All Statuses</option>
            <option value="backlog">Backlog</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs px-2 py-1 border dark:border-dark-border rounded bg-white dark:bg-dark-card dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-accent/50"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <span className="text-xs text-gray-400">{filtered.length} issue{filtered.length !== 1 ? "s" : ""}</span>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="text-xs bg-accent text-white hover:bg-accent-light px-3 py-1 rounded-lg"
          >
            {showForm ? "Cancel" : "New Issue"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="px-5 py-4 border-b dark:border-dark-border bg-gray-50/50 dark:bg-dark-card/50">
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Title *</label>
              <input
                required
                type="text"
                placeholder="Issue title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-card dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Description</label>
              <textarea
                rows={3}
                placeholder="Optional description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-card dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Project</label>
                <select
                  value={form.projectId}
                  onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-card dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-card dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Assignee</label>
                <select
                  value={form.assigneeAgentId}
                  onChange={(e) => setForm({ ...form, assigneeAgentId: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-card dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  <option value="">Unassigned</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.title || a.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !form.projectId}
                className="text-sm bg-accent text-white hover:bg-accent-light px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Issue"}
              </button>
            </div>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400">
          No issues match the current filters.
        </div>
      ) : (
        <div className="divide-y dark:divide-dark-border">
          {filtered.map((issue) => {
            const isExpanded = expandedId === issue.id;
            return (
              <div key={issue.id}>
                <div
                  className="px-5 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-card/40"
                  onClick={() => handleExpand(issue.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {issue.identifier && (
                      <span className="text-xs font-mono text-gray-400 shrink-0">{issue.identifier}</span>
                    )}
                    <p className="text-sm font-medium truncate">{issue.title}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {issue.assigneeAgentId && agentMap.has(issue.assigneeAgentId) && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
                        {agentMap.get(issue.assigneeAgentId)!.title || agentMap.get(issue.assigneeAgentId)!.name}
                      </span>
                    )}
                    <PriorityBadge priority={issue.priority} />
                    <StatusBadge status={issue.status} />
                    <span className="text-xs text-gray-400 hidden sm:inline">
                      {formatDate(issue.createdAt)}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(issue); }}
                      className="text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div
                    className="px-5 pb-4 border-t dark:border-dark-border bg-gray-50/50 dark:bg-dark-card/30"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {issue.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-3 mb-4 whitespace-pre-wrap">
                        {issue.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mb-4">
                      <label className="text-xs text-gray-500 dark:text-gray-400">Status:</label>
                      <select
                        value={issue.status}
                        onChange={(e) => handleStatusChange(issue.id, e.target.value)}
                        className="text-xs px-2 py-1 border dark:border-dark-border rounded bg-white dark:bg-dark-card dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-accent/50"
                      >
                        <option value="backlog">Backlog</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    <div className="space-y-2 mb-3">
                      {(comments[issue.id] || []).map((c) => (
                        <div key={c.id} className="text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-dark-card border dark:border-dark-border rounded px-3 py-2">
                          <span className="text-gray-400 dark:text-gray-500 mr-2">{c.authorType}:</span>
                          {c.body}
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add a comment..."
                        value={commentInputs[issue.id] ?? ""}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({ ...prev, [issue.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment(issue.id);
                          }
                        }}
                        className="flex-1 px-3 py-2 border dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-card dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent/50"
                      />
                      <button
                        onClick={() => handleAddComment(issue.id)}
                        className="text-xs bg-accent text-white hover:bg-accent-light px-3 py-2 rounded-lg"
                      >
                        Post
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    backlog: "bg-gray-100 dark:bg-dark-card text-gray-500",
    in_progress: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
    done: "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400",
    cancelled: "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles[status] ?? styles.backlog}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    urgent: "text-red-500",
    high: "text-orange-500",
    medium: "text-yellow-500",
    low: "text-gray-400",
  };
  return (
    <span className={`text-[10px] font-medium uppercase ${styles[priority] ?? styles.medium}`}>
      {priority}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
