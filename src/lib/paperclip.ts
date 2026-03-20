const PAPERCLIP_URL = "http://localhost:3101";

export interface PaperclipIssue {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assigneeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaperclipAgent {
  id: string;
  name: string;
  role: string;
  status: string;
}

async function paperclipFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${PAPERCLIP_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!resp.ok) {
    throw new Error(`Paperclip API error: ${resp.status} ${resp.statusText}`);
  }
  return resp.json();
}

export async function listIssues(companyId: string, projectId: string): Promise<PaperclipIssue[]> {
  const data = await paperclipFetch<{ issues: PaperclipIssue[] }>(
    `/api/companies/${companyId}/projects/${projectId}/issues`
  );
  return data.issues;
}

export async function createIssue(
  companyId: string,
  projectId: string,
  issue: { title: string; description: string; priority?: string }
): Promise<PaperclipIssue> {
  return paperclipFetch<PaperclipIssue>(
    `/api/companies/${companyId}/projects/${projectId}/issues`,
    {
      method: "POST",
      body: JSON.stringify(issue),
    }
  );
}

export async function updateIssue(
  issueId: string,
  update: Partial<PaperclipIssue>
): Promise<PaperclipIssue> {
  return paperclipFetch<PaperclipIssue>(`/api/issues/${issueId}`, {
    method: "PATCH",
    body: JSON.stringify(update),
  });
}

export async function listAgents(companyId: string): Promise<PaperclipAgent[]> {
  const data = await paperclipFetch<{ agents: PaperclipAgent[] }>(
    `/api/companies/${companyId}/agents`
  );
  return data.agents;
}
