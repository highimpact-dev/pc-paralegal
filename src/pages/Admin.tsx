import { useState, useEffect } from "react";

const API = "http://localhost:3101/api";

interface Agent {
  id: string;
  name: string;
  title: string;
  role: string;
  status: string;
  capabilities: string;
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
  status: string;
}

interface Issue {
  id: string;
  title: string;
  status: string;
  priority: string;
  identifier: string;
  assigneeAgentId: string | null;
  createdAt: string;
}

export default function Admin() {
  const [company, setCompany] = useState<Company | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
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
      const agentsData = await agentsRes.json();
      const projectsData = await projectsRes.json();
      setAgents(agentsData.agents || []);
      setProjects(projectsData.projects || []);

      // Load issues from first project
      if (projectsData.projects?.length > 0) {
        const issuesRes = await fetch(`${API}/companies/${co.id}/projects/${projectsData.projects[0].id}/issues`);
        const issuesData = await issuesRes.json();
        setIssues(issuesData.issues || []);
      }
      setError(null);
    } catch {
      setError("Cannot connect to Paperclip server");
    }
  }

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

  const agentMap = new Map(agents.map((a) => [a.id, a]));

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Admin Panel</h2>
        {company && (
          <span className="text-xs bg-gray-100 dark:bg-dark-card px-2 py-1 rounded font-mono">
            {company.name} ({company.issuePrefix})
          </span>
        )}
      </div>

      <div className="space-y-6">
        {/* Agents */}
        <section className="border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface overflow-hidden">
          <div className="px-5 py-3 border-b dark:border-dark-border bg-gray-50 dark:bg-dark-card flex items-center justify-between">
            <h3 className="font-semibold text-sm">Agents</h3>
            <span className="text-xs text-gray-400">{agents.length} registered</span>
          </div>
          <div className="divide-y dark:divide-dark-border">
            {agents.map((agent) => (
              <div key={agent.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent/10 dark:bg-accent/20 flex items-center justify-center text-xs font-bold text-accent dark:text-blue-400">
                    {agent.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{agent.title || agent.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{agent.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {agent.capabilities && (
                    <div className="hidden sm:flex gap-1">
                      {agent.capabilities.split(",").slice(0, 3).map((cap) => (
                        <span key={cap} className="text-[10px] bg-gray-100 dark:bg-dark-card px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400">
                          {cap.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    agent.status === "idle"
                      ? "bg-gray-100 dark:bg-dark-card text-gray-500"
                      : agent.status === "running"
                        ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                        : "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400"
                  }`}>
                    {agent.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Projects */}
        <section className="border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface overflow-hidden">
          <div className="px-5 py-3 border-b dark:border-dark-border bg-gray-50 dark:bg-dark-card flex items-center justify-between">
            <h3 className="font-semibold text-sm">Projects</h3>
            <span className="text-xs text-gray-400">{projects.length} project{projects.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="divide-y dark:divide-dark-border">
            {projects.map((project) => (
              <div key={project.id} className="px-5 py-3 flex items-center justify-between">
                <p className="text-sm font-medium">{project.name}</p>
                <span className="text-xs bg-gray-100 dark:bg-dark-card px-2 py-0.5 rounded">
                  {project.status}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Issues */}
        <section className="border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface overflow-hidden">
          <div className="px-5 py-3 border-b dark:border-dark-border bg-gray-50 dark:bg-dark-card flex items-center justify-between">
            <h3 className="font-semibold text-sm">Issues</h3>
            <span className="text-xs text-gray-400">{issues.length} issue{issues.length !== 1 ? "s" : ""}</span>
          </div>
          {issues.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              No issues yet. Tasks will appear here when documents are processed.
            </div>
          ) : (
            <div className="divide-y dark:divide-dark-border">
              {issues.map((issue) => (
                <div key={issue.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {issue.identifier && (
                        <span className="text-xs font-mono text-gray-400">{issue.identifier}</span>
                      )}
                      <p className="text-sm font-medium">{issue.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {issue.assigneeAgentId && agentMap.has(issue.assigneeAgentId) && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {agentMap.get(issue.assigneeAgentId)!.name}
                        </span>
                      )}
                      <PriorityBadge priority={issue.priority} />
                      <StatusBadge status={issue.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
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
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles[status] || styles.backlog}`}>
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
    <span className={`text-[10px] font-medium uppercase ${styles[priority] || styles.medium}`}>
      {priority}
    </span>
  );
}
