/**
 * Document Processing Pipeline
 *
 * Runs entirely through existing Tauri IPC + Paperclip issues.
 * No child processes. No spawned scripts.
 *
 * Flow:
 * 1. Parse document (Tauri parse_document)
 * 2. Save parsed text
 * 3. Create Paperclip issue → assign to Reviewer (handoff = parsed file path)
 * 4. Classify + Review via Ollama (Tauri chat_completion)
 * 5. Save review deliverable
 * 6. Mark review issue done, create summary issue → assign to Drafter
 * 7. Generate summary via Ollama
 * 8. Save summary deliverable
 * 9. Mark summary issue done
 */

import { parseDocument, chatCompletion, writeFileText } from "./tauri";
import { getModel } from "./settings";

const PAPERCLIP_API = "http://localhost:3101/api";

const AGENTS = {
  company: "5aa5315e-0ff5-40e7-8244-c432a342b6de",
  project: "60f88f9f-c00e-4adf-afc9-bbe933cfb3d3",
  director: "34e054d6-84e5-4639-b6f0-327c22ee52e8",
  reviewer: "e709ac1b-fc66-4478-be1c-44883a692d03",
  drafter: "abf62539-3335-43be-8132-d4f19801025e",
};

export interface PipelineStatus {
  step: "parsing" | "classifying" | "reviewing" | "summarizing" | "complete" | "error";
  filename: string;
  message: string;
  documentType?: string;
  deliverables?: string[];
  error?: string;
}

type StatusCallback = (status: PipelineStatus) => void;

// --- Paperclip helpers (fire-and-forget, non-fatal) ---

async function createIssue(
  title: string,
  description: string,
  assigneeAgentId: string,
  token: string | null
): Promise<string | null> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${PAPERCLIP_API}/companies/${AGENTS.company}/issues`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title,
        description,
        priority: "high",
        projectId: AGENTS.project,
        assigneeAgentId,
        createdByAgentId: AGENTS.director,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.id;
    }
  } catch {}
  return null;
}

async function updateIssue(issueId: string, status: string, token: string | null) {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    await fetch(`${PAPERCLIP_API}/issues/${issueId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status }),
    });
  } catch {}
}

async function postComment(issueId: string, content: string, agentId: string, token: string | null) {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    await fetch(`${PAPERCLIP_API}/issues/${issueId}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content, agentId }),
    });
  } catch {}
}

// --- Prompts ---

const CLASSIFIER_PROMPT = `You are a legal document classifier. Given document text and filename, classify it into exactly one type.

Types: contract, nda, pleading, correspondence, discovery, corporate, regulatory, unknown

Respond with ONLY a JSON object (no markdown):
{"type": "contract", "subtype": "master_services_agreement", "confidence": "high", "reasoning": "..."}`;

const CONTRACT_REVIEW_PROMPT = `You are an expert legal contract reviewer. Produce a structured, actionable review:

1. **Document Overview** - table with: Document Type, Parties, Effective Date, Term, Governing Law
2. **Risk Register** - table: #, Clause/Section, Risk Level (CRITICAL/HIGH/MEDIUM/LOW), Issue, Recommendation
3. **Clause-by-Clause Analysis** - analyze: Term & Termination, Payment, Indemnification, Limitation of Liability, IP, Confidentiality, Reps & Warranties, Dispute Resolution, Non-compete, Assignment, Force Majeure, Data Protection, Insurance
4. **Missing Standard Provisions** - what's absent and why it matters
5. **Red Flags** - one-sided terms, broad discretion, ambiguous language, missing references
6. **Recommended Actions** - prioritized by severity

Rules: Reference specific sections. Quote exact language. Be specific, not generic. If a clause is fair, say so briefly.`;

const GENERIC_REVIEW_PROMPT = (docType: string) =>
  `You are a paralegal reviewing a ${docType} document. Provide:
1. **Document Overview**: What this is, parties, key dates
2. **Key Provisions**: Most important terms
3. **Issues & Concerns**: Anything problematic or unusual
4. **Missing Elements**: Standard provisions that are absent
5. **Recommendations**: Specific next steps
Be specific. Reference exact sections.`;

const SUMMARY_PROMPT = `You are a paralegal writing an executive summary for an attorney. Include:
1. **Executive Summary** (2-3 sentences)
2. **Parties** and their roles
3. **Key Terms** in plain language
4. **Issues Found** organized by severity (CRITICAL, HIGH, MEDIUM, LOW)
5. **Bottom Line** - ready to sign, needs revision, or serious problems?
Write for a busy attorney. 60 seconds to read. No jargon where plain language works.`;

// --- Pipeline ---

export async function processDocument(
  filePath: string,
  token: string | null,
  onStatus: StatusCallback
): Promise<void> {
  const filename = filePath.split("/").pop() || filePath;
  const baseName = filename.replace(/\.[^.]+$/, "");
  const model = getModel();

  // Use dynamic import to get home dir
  let home: string;
  try {
    const { homeDir } = await import("@tauri-apps/api/path");
    home = await homeDir();
  } catch {
    home = "/Users/aialchemy";
  }

  const parsedPath = `${home}/paralegal/parsed/${baseName}.txt`;
  const reviewPath = `${home}/paralegal/deliverables/review-${baseName}.md`;
  const summaryPath = `${home}/paralegal/deliverables/summary-${baseName}.md`;

  try {
    // ── Step 1: Parse ──
    onStatus({ step: "parsing", filename, message: "Parsing document..." });

    const parsed = await parseDocument(filePath);
    if (!parsed.text || parsed.text.trim().length < 50) {
      throw new Error(`Parsing produced insufficient text (${parsed.text?.length || 0} chars)`);
    }

    await writeFileText(parsedPath, parsed.text);

    // ── Step 2: Create review issue (handoff) ──
    const reviewIssueId = await createIssue(
      `Review: ${filename}`,
      `Classify and review document.\n\nParsed text: ${parsedPath}\nOriginal: ${filePath}\nPages: ${parsed.pages || "unknown"}`,
      AGENTS.reviewer,
      token
    );
    if (reviewIssueId) {
      await updateIssue(reviewIssueId, "in_progress", token);
    }

    // ── Step 3: Classify ──
    onStatus({ step: "classifying", filename, message: "Classifying document type..." });

    const classifyResponse = await chatCompletion(model, [
      { role: "system", content: CLASSIFIER_PROMPT },
      { role: "user", content: `Classify this document.\n\nFilename: ${filename}\n\n${parsed.text.slice(0, 3000)}` },
    ]);

    let docType = "unknown";
    let docSubtype = "unclassified";
    try {
      let jsonStr = classifyResponse.message.content.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      }
      const classification = JSON.parse(jsonStr);
      docType = classification.type || "unknown";
      docSubtype = classification.subtype || "unclassified";
    } catch {}

    // ── Step 4: Review ──
    onStatus({
      step: "reviewing",
      filename,
      message: `Reviewing as ${docType}...`,
      documentType: docType,
    });

    const reviewPrompt =
      docType === "contract" || docType === "nda"
        ? CONTRACT_REVIEW_PROMPT
        : GENERIC_REVIEW_PROMPT(docType);

    const reviewResponse = await chatCompletion(model, [
      { role: "system", content: reviewPrompt },
      { role: "user", content: `Review this document.\n\nDocument: ${filename}\n\n---\n\n${parsed.text}` },
    ]);

    const reviewContent = `# Contract Review: ${filename}\n\n**Date:** ${new Date().toLocaleString()}\n**Type:** ${docType} (${docSubtype})\n**Skill:** contract-review v1.0\n\n---\n\n${reviewResponse.message.content}`;
    await writeFileText(reviewPath, reviewContent);

    // Mark review issue done
    if (reviewIssueId) {
      await postComment(
        reviewIssueId,
        `**Review complete**\nType: ${docType} (${docSubtype})\nDeliverable: \`review-${baseName}.md\``,
        AGENTS.reviewer,
        token
      );
      await updateIssue(reviewIssueId, "done", token);
    }

    // ── Step 5: Create summary issue (handoff) ──
    const summaryIssueId = await createIssue(
      `Summary: ${filename}`,
      `Generate executive summary.\n\nParsed text: ${parsedPath}\nReview: ${reviewPath}`,
      AGENTS.drafter,
      token
    );
    if (summaryIssueId) {
      await updateIssue(summaryIssueId, "in_progress", token);
    }

    // ── Step 6: Summary ──
    onStatus({ step: "summarizing", filename, message: "Generating summary..." });

    const summaryResponse = await chatCompletion(model, [
      { role: "system", content: SUMMARY_PROMPT },
      {
        role: "user",
        content: `Summarize this document incorporating review findings.\n\n---REVIEW---\n${reviewResponse.message.content}\n---END REVIEW---\n\nOriginal (first 8000 chars):\n---DOCUMENT---\n${parsed.text.slice(0, 8000)}\n---END DOCUMENT---`,
      },
    ]);

    const summaryContent = `# Summary: ${filename}\n\n**Date:** ${new Date().toLocaleString()}\n**Type:** ${docType} (${docSubtype})\n\n---\n\n${summaryResponse.message.content}`;
    await writeFileText(summaryPath, summaryContent);

    // Mark summary issue done
    if (summaryIssueId) {
      await postComment(
        summaryIssueId,
        `**Summary complete**\nDeliverable: \`summary-${baseName}.md\``,
        AGENTS.drafter,
        token
      );
      await updateIssue(summaryIssueId, "done", token);
    }

    // ── Done ──
    onStatus({
      step: "complete",
      filename,
      message: "Processing complete",
      documentType: docType,
      deliverables: [`review-${baseName}.md`, `summary-${baseName}.md`],
    });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    onStatus({
      step: "error",
      filename,
      message: `Failed: ${errorMsg}`,
      error: errorMsg,
    });
  }
}
