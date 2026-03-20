import { useState, useEffect, useCallback } from "react";
import AgentsTab from "./admin/AgentsTab";
import IssuesTab from "./admin/IssuesTab";
import ActivityTab from "./admin/ActivityTab";

const API = "http://localhost:3101/api";

type Tab = "agents" | "issues" | "projects" | "activity";

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

interface Company {
  id: string;
  name: string;
  issuePrefix: string;
  issueCounter: number;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  companyId: string;
}

const tabs: { key: Tab; label: string }[] = [
  { key: "agents", label: "Agents" },
  { key: "issues", label: "Issues" },
  { key: "projects", label: "Projects" },
  { key: "activity", label: "Activity" },
];

export default function Admin() {
  const [tab, setTab] = useState<Tab>("agents");
  const [company, setCompany] = useState<Company | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const companiesRes = await fetch(`${API}/companies`);
      const { companies } = await companiesRes.json();
      if (companies.length === 0) return;
      const co = companies[0];
      setCompany(co);

      const [agentsRes, projectsRes] = await Promise.all([
        fetch(`${API}/companies/${co.id}/agents`),
        fetch(`${API}/companies/${co.id}/projects`),
      ]);
      setAgents((await agentsRes.json()).agents || []);
      setProjects((await projectsRes.json()).projects || []);
      setError(null);
    } catch {
      setError("Cannot connect to Paperclip server");
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (error) {
    return (
      <div className="max-w-4xl">
        <h2 className="text-2xl font-bold mb-6">Admin Panel</h2>
        <div className="border dark:border-dark-border rounded-lg p-8 text-center bg-white dark:bg-dark-surface">
          <p className="text-gray-500 dark:text-gray-400">{error}</p>
          <p className="text-sm text-gray-400 mt-1">Start Paperclip from Settings</p>
        </div>
      </div>
    );
  }

  if (!company) return null;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Admin Panel</h2>
        <span className="text-xs bg-gray-100 dark:bg-dark-card px-2 py-1 rounded font-mono">
          {company.name} ({company.issuePrefix})
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b dark:border-dark-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? "border-accent text-accent dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.label}
            {t.key === "agents" && agents.length > 0 && (
              <span className="ml-1.5 text-xs text-gray-400">{agents.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "agents" && (
        <AgentsTab companyId={company.id} agents={agents} onRefresh={loadData} />
      )}
      {tab === "issues" && (
        <IssuesTab companyId={company.id} projects={projects} agents={agents} onRefresh={loadData} />
      )}
      {tab === "projects" && (
        <ProjectsSection companyId={company.id} projects={projects} onRefresh={loadData} />
      )}
      {tab === "activity" && (
        <ActivityTab companyId={company.id} />
      )}
    </div>
  );
}

// Projects is simple enough to keep inline
function ProjectsSection({ companyId, projects, onRefresh }: { companyId: string; projects: Project[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`${API}/companies/${companyId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      setName("");
      setDescription("");
      setShowForm(false);
      onRefresh();
    } catch {}
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-light transition-colors"
        >
          {showForm ? "Cancel" : "New Project"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="border dark:border-dark-border rounded-lg p-4 bg-white dark:bg-dark-surface space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className="w-full px-3 py-2 border dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-card dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full px-3 py-2 border dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-card dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
          />
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light disabled:opacity-50 transition-colors"
          >
            {submitting ? "Creating..." : "Create Project"}
          </button>
        </form>
      )}

      <div className="border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface overflow-hidden divide-y dark:divide-dark-border">
        {projects.map((p) => (
          <div key={p.id} className="px-5 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{p.name}</p>
              {p.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{p.description}</p>}
            </div>
            <span className="text-xs bg-gray-100 dark:bg-dark-card px-2 py-0.5 rounded">{p.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
