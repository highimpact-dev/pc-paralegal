/**
 * Paperclip API client for agent scripts.
 * Talks to the local Paperclip server to create/update issues and post comments.
 */

const PAPERCLIP_URL = process.env.PAPERCLIP_URL || "http://localhost:3101";

// Agent IDs — read from config or env
export const AGENTS = {
  company: process.env.PC_COMPANY_ID || "5aa5315e-0ff5-40e7-8244-c432a342b6de",
  project: process.env.PC_PROJECT_ID || "60f88f9f-c00e-4adf-afc9-bbe933cfb3d3",
  director: process.env.PC_DIRECTOR_ID || "34e054d6-84e5-4639-b6f0-327c22ee52e8",
  reviewer: process.env.PC_REVIEWER_ID || "e709ac1b-fc66-4478-be1c-44883a692d03",
  drafter: process.env.PC_DRAFTER_ID || "abf62539-3335-43be-8132-d4f19801025e",
};

interface CreateIssueParams {
  title: string;
  description?: string;
  priority?: string;
  assigneeAgentId?: string;
  createdByAgentId?: string;
}

interface Issue {
  id: string;
  title: string;
  status: string;
  identifier?: string;
}

async function api(
  path: string,
  options: RequestInit = {}
): Promise<Record<string, unknown>> {
  const url = `${PAPERCLIP_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Paperclip API ${res.status}: ${path} — ${text}`);
  }

  return res.json() as Promise<Record<string, unknown>>;
}

export async function createIssue(params: CreateIssueParams): Promise<Issue> {
  const data = await api(
    `/api/companies/${AGENTS.company}/issues`,
    {
      method: "POST",
      body: JSON.stringify({
        title: params.title,
        description: params.description || "",
        priority: params.priority || "medium",
        projectId: AGENTS.project,
        assigneeAgentId: params.assigneeAgentId,
        createdByAgentId: params.createdByAgentId,
      }),
    }
  );
  return data as unknown as Issue;
}

export async function updateIssueStatus(
  issueId: string,
  status: string
): Promise<void> {
  await api(`/api/issues/${issueId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function postComment(
  issueId: string,
  content: string,
  agentId?: string
): Promise<void> {
  if (issueId === "no-issue") return;
  try {
    await api(`/api/issues/${issueId}/comments`, {
      method: "POST",
      body: JSON.stringify({
        content,
        agentId,
      }),
    });
  } catch {
    // Non-fatal — don't crash the agent over a comment failure
  }
}

export async function checkoutIssue(
  issueId: string,
  agentId: string
): Promise<void> {
  if (issueId === "no-issue") return;
  try {
    await api(`/api/issues/${issueId}/checkout`, {
      method: "POST",
      body: JSON.stringify({
        agentId,
        expectedStatuses: ["backlog", "todo", "in_progress"],
      }),
    });
  } catch {
    // Checkout might fail if already checked out — that's ok
  }
  try {
    await updateIssueStatus(issueId, "in_progress");
  } catch {
    // Non-fatal
  }
}

export async function markDone(issueId: string): Promise<void> {
  if (issueId === "no-issue") return;
  try {
    await updateIssueStatus(issueId, "done");
  } catch {
    // Non-fatal
  }
}
