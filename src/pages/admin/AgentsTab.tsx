import { useState } from "react";

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

interface Props {
  companyId: string;
  agents: Agent[];
  onRefresh: () => void;
}

interface NewAgentForm {
  name: string;
  title: string;
  role: string;
  capabilities: string;
  adapterType: string;
}

const emptyForm: NewAgentForm = {
  name: "",
  title: "",
  role: "general",
  capabilities: "",
  adapterType: "process",
};

export default function AgentsTab({ companyId, agents, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewAgentForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch(`${API}/companies/${companyId}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          title: form.title || null,
          role: form.role,
          capabilities: form.capabilities || null,
          adapterType: form.adapterType,
        }),
      });
      setForm(emptyForm);
      setShowForm(false);
      onRefresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(agent: Agent) {
    const newStatus = agent.status === "paused" ? "idle" : "paused";
    await fetch(`${API}/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    onRefresh();
  }

  async function handleDelete(agent: Agent) {
    if (!window.confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) return;
    await fetch(`${API}/agents/${agent.id}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <section className="border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface overflow-hidden">
      <div className="px-5 py-3 border-b dark:border-dark-border bg-gray-50 dark:bg-dark-card flex items-center justify-between">
        <h3 className="font-semibold text-sm">Agents</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{agents.length} registered</span>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="text-xs bg-accent text-white hover:bg-accent-light px-3 py-1 rounded-lg"
          >
            {showForm ? "Cancel" : "Add Agent"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="px-5 py-4 border-b dark:border-dark-border bg-gray-50/50 dark:bg-dark-card/50">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. ResearchAgent"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-card dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Research Specialist"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-card dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-card dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  <option value="orchestrator">orchestrator</option>
                  <option value="analyst">analyst</option>
                  <option value="writer">writer</option>
                  <option value="general">general</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Capabilities</label>
                <input
                  type="text"
                  placeholder="e.g. research,writing,analysis"
                  value={form.capabilities}
                  onChange={(e) => setForm({ ...form, capabilities: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-card dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="text-sm bg-accent text-white hover:bg-accent-light px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Agent"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="divide-y dark:divide-dark-border">
        {agents.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            No agents registered yet.
          </div>
        ) : (
          agents.map((agent) => (
            <div key={agent.id} className="px-5 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 shrink-0 rounded-lg bg-accent/10 dark:bg-accent/20 flex items-center justify-center text-xs font-bold text-accent dark:text-blue-400">
                  {agent.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{agent.title || agent.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{agent.role}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {agent.capabilities && (
                  <div className="hidden sm:flex gap-1">
                    {agent.capabilities.split(",").slice(0, 3).map((cap) => (
                      <span
                        key={cap}
                        className="text-[10px] bg-gray-100 dark:bg-dark-card px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400"
                      >
                        {cap.trim()}
                      </span>
                    ))}
                  </div>
                )}

                <StatusBadge status={agent.status} />

                {agent.status !== "running" && (
                  <button
                    onClick={() => handleToggleStatus(agent)}
                    className="text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-card px-2 py-1 rounded"
                  >
                    {agent.status === "paused" ? "Resume" : "Pause"}
                  </button>
                )}

                <button
                  onClick={() => handleDelete(agent)}
                  className="text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    idle: "bg-gray-100 dark:bg-dark-card text-gray-500",
    running: "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400",
    paused: "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles[status] ?? styles.idle}`}>
      {status}
    </span>
  );
}
