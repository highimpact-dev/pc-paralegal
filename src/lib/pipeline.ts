/**
 * Paperclip-driven document processing.
 *
 * Director: parse document, create issue for Reviewer. Done.
 * Heartbeat: polls each agent's Paperclip inbox, processes assigned work.
 * Each agent checks out its issue, does the work, hands off via new issue.
 */

import { parseDocument, chatCompletion, writeFileText } from "./tauri";
import { getModel } from "./settings";

const API = "http://localhost:3101/api";

const COMPANY_ID = "5aa5315e-0ff5-40e7-8244-c432a342b6de";
const PROJECT_ID = "60f88f9f-c00e-4adf-afc9-bbe933cfb3d3";
const DIRECTOR_ID = "34e054d6-84e5-4639-b6f0-327c22ee52e8";
const REVIEWER_ID = "e709ac1b-fc66-4478-be1c-44883a692d03";
const DRAFTER_ID = "abf62539-3335-43be-8132-d4f19801025e";

// --- Paperclip API helpers ---

async function api(path: string, token: string | null, options?: RequestInit) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function getAgentInbox(agentId: string, token: string | null) {
  const data = await api(
    `/companies/${COMPANY_ID}/issues?assigneeAgentId=${agentId}&status=todo,in_progress`,
    token
  );
  return data.issues || [];
}

async function checkout(issueId: string, agentId: string, token: string | null) {
  return api(`/issues/${issueId}/checkout`, token, {
    method: "POST",
    body: JSON.stringify({ agentId, expectedStatuses: ["todo", "backlog", "in_progress"] }),
  });
}

async function patchIssue(issueId: string, update: Record<string, unknown>, token: string | null) {
  return api(`/issues/${issueId}`, token, {
    method: "PATCH",
    body: JSON.stringify(update),
  });
}

async function postComment(issueId: string, content: string, agentId: string, token: string | null) {
  return api(`/issues/${issueId}/comments`, token, {
    method: "POST",
    body: JSON.stringify({ content, agentId }),
  });
}

async function createIssue(
  title: string,
  description: string,
  assigneeAgentId: string,
  createdByAgentId: string,
  token: string | null
) {
  return api(`/companies/${COMPANY_ID}/issues`, token, {
    method: "POST",
    body: JSON.stringify({
      title,
      description,
      priority: "high",
      projectId: PROJECT_ID,
      assigneeAgentId,
      createdByAgentId,
      status: "todo",
    }),
  });
}

// --- Prompts ---

const CLASSIFIER_PROMPT = `You are a legal document classifier. Given document text and filename, classify it into exactly one type.
Types: contract, nda, pleading, correspondence, discovery, corporate, regulatory, unknown
Respond with ONLY a JSON object (no markdown):
{"type": "contract", "subtype": "master_services_agreement", "confidence": "high", "reasoning": "..."}`;

const CONTRACT_REVIEW_PROMPT = `You are an expert legal contract reviewer performing a comprehensive clause-by-clause analysis. You produce structured, actionable reviews that a supervising attorney can act on immediately.

## Your Review Must Include:

### 1. Document Overview

Produce a table with these fields:
- Document Type (e.g., Master Services Agreement, NDA, Employment Agreement, SaaS Agreement, Vendor Agreement)
- Parties (list all parties with their defined roles/abbreviations)
- Effective Date (or "not specified")
- Term (duration, auto-renewal terms, notice period for non-renewal)
- Governing Law (jurisdiction and venue)

### 2. Risk Register

For EVERY material clause, assess risk and provide a specific recommendation. Format as a markdown table:

| # | Clause/Section | Risk Level | Issue | Recommendation |
|---|---|---|---|---|

Risk Levels:
- CRITICAL: Must be addressed before signing. Creates unacceptable legal or financial exposure.
- HIGH: Strongly recommend addressing. Significantly disadvantageous or non-standard terms.
- MEDIUM: Should discuss. Potentially problematic or worth negotiating.
- LOW: Note for awareness. Minor or stylistic.

### 3. Clause-by-Clause Analysis

Analyze each section below. For each: quote the relevant language, assess fairness/market-standard, flag issues, suggest specific changes. If a section is absent, note it explicitly.

- **Term & Termination**: Duration, renewal mechanism, termination triggers (for cause/convenience), cure periods, effect of termination, survival clauses
- **Payment & Financial**: Payment terms (net 30/60/etc.), late fees, price adjustment/escalation, expense reimbursement, taxes, audit rights
- **Indemnification**: Mutual vs. one-sided, scope of covered claims, caps (per-incident and aggregate), carve-outs, defense/control procedures, insurance requirements
- **Limitation of Liability**: Caps on direct damages (fixed dollar vs. contract value multiple), consequential damages waiver (mutual?), exclusions from cap (IP infringement, confidentiality breach, indemnification), uncapped liabilities
- **Intellectual Property**: Ownership of work product, pre-existing IP protections, license grants (scope, exclusivity, perpetuity), moral rights waiver, open source implications
- **Confidentiality**: Definition of confidential information, exclusions, permitted disclosures (legal/regulatory), duration of obligations, return/destruction obligations, injunctive relief
- **Representations & Warranties**: Scope and specificity, survival period post-termination, sole remedy provisions, disclaimer of implied warranties
- **Dispute Resolution**: Arbitration vs. litigation, arbitration body/rules, venue/forum selection, prevailing party attorney fees, escalation procedures
- **Non-compete/Non-solicitation**: Scope of restricted activities, geographic limitations, duration, employee vs. customer non-solicit, enforceability concerns
- **Assignment & Change of Control**: Consent requirements, permitted assignments (affiliates), effect of change of control, anti-assignment provisions
- **Force Majeure**: Defined events, notification requirements, mitigation obligations, termination right after extended force majeure
- **Data Protection & Privacy**: Personal data handling obligations, data breach notification timeline, data processing agreement requirements, cross-border transfer restrictions
- **Insurance**: Required coverage types (CGL, E&O, cyber), minimum coverage amounts, additional insured requirements, certificate requirements

### 4. Missing Standard Provisions

For this contract type, identify standard provisions that are absent. For each missing provision:
- What is missing
- Why it matters (the risk of omission)
- Recommended approach

### 5. Red Flags

Flag any clause that:
- Is unusually one-sided or heavily favors one party
- Contains broad discretionary language ("at sole discretion", "as it deems appropriate", "in its sole judgment")
- Uses non-standard definitions that modify typical legal meanings
- References external documents, policies, or exhibits not attached or incorporated
- Contains ambiguous or vague language creating interpretive uncertainty
- Includes unusual remedies, penalties, or acceleration clauses

### 6. Recommended Actions

Prioritized list of specific next steps:
- [CRITICAL] items first (must address before signing)
- [HIGH] items next
- [MEDIUM] items last
- For each, state the specific action, not just "review" or "consider"

## Rules

- Reference specific section numbers and quote exact language
- Be specific, not generic. "Section 7.2 lacks a liability cap, exposing Client to unlimited indemnification" not "consider reviewing indemnification"
- If a section is well-drafted, balanced, and market-standard, say so briefly and move on. Do not manufacture concerns.
- Flag anything unusual for the contract type even if not inherently problematic
- When recommending changes, suggest specific concepts or language direction, not boilerplate
- Treat both parties fairly in your analysis. Note imbalances in either direction.
- If the document quality is poor (e.g., template with unfilled brackets, inconsistent defined terms), flag that as a global issue`;

const GENERIC_REVIEW_PROMPT = (docType: string) =>
  `You are a paralegal reviewing a ${docType} document. Provide a thorough analysis with:

1. **Document Overview**: What this document is, all parties involved, key dates, governing law
2. **Key Provisions**: The most important terms and conditions, with specific section references
3. **Issues & Concerns**: Anything problematic, unusual, or requiring attention. For each issue:
   - Quote the relevant language
   - Explain why it's concerning
   - Suggest a specific remedy
4. **Missing Elements**: Standard provisions for this document type that are absent. For each:
   - What is missing
   - Why it matters
   - Recommended approach
5. **Recommendations**: Prioritized list of specific next steps, categorized by severity (CRITICAL/HIGH/MEDIUM/LOW)

Rules:
- Reference exact section numbers and quote language
- Be specific, not generic
- If something is well-drafted, say so briefly and move on
- Flag anything unusual for this document type`;

const SUMMARY_PROMPT = `You are a paralegal writing an executive summary of a document that has already been reviewed. Your summary is for a busy attorney who needs the essential facts in 60 seconds.

Your summary MUST include:

1. **Executive Summary** (2-3 sentences): What this document is and its primary purpose. Be specific about what it governs.

2. **Parties**: Who is involved, their roles, and their defined abbreviations in the document.

3. **Key Terms**: The most important terms in plain language:
   - Effective date and term length
   - Financial terms (amounts, payment schedules, penalties)
   - Key obligations on each party
   - Termination triggers and notice periods
   - Any non-compete or exclusivity provisions

4. **Issues Found**: Summarize the issues identified in the review, organized by severity:
   - CRITICAL: Must address before signing
   - HIGH: Strongly recommend addressing
   - MEDIUM: Worth discussing
   - LOW: Awareness items
   Include the specific clause references from the review.

5. **Bottom Line**: One paragraph direct assessment:
   - Is this document ready to sign as-is?
   - If not, what are the 2-3 most important things to address?
   - What is the overall risk level?
   - Any deal-breakers?

Rules:
- No legal jargon where plain language works
- Be direct about the risk level
- If the review found no significant issues, say so clearly
- Reference specific sections when citing issues`;


// --- Director: ingest only ---

export async function directorIngest(filePath: string, token: string | null): Promise<void> {
  const filename = filePath.split("/").pop() || filePath;
  const baseName = filename.replace(/\.[^.]+$/, "");

  let home: string;
  try {
    const { homeDir } = await import("@tauri-apps/api/path");
    home = await homeDir();
  } catch {
    home = "/Users/aialchemy";
  }

  const parsedPath = `${home}/paralegal/parsed/${baseName}.txt`;

  // Parse the document
  const parsed = await parseDocument(filePath);
  if (!parsed.text || parsed.text.trim().length < 50) {
    throw new Error(`Parsing failed for ${filename} (${parsed.text?.length || 0} chars)`);
  }

  // Save parsed text
  await writeFileText(parsedPath, parsed.text);

  // Create issue for Reviewer — this IS the handoff
  await createIssue(
    `Review: ${filename}`,
    `Classify and review this document.\n\nParsed text: ${parsedPath}\nOriginal: ${filePath}\nPages: ${parsed.pages || "unknown"}`,
    REVIEWER_ID,
    DIRECTOR_ID,
    token
  );
}

// --- Agent heartbeat ---

export async function agentHeartbeat(token: string | null): Promise<void> {
  // Check Reviewer inbox
  try {
    const reviewerIssues = await getAgentInbox(REVIEWER_ID, token);
    for (const issue of reviewerIssues) {
      if (issue.status === "todo" || issue.status === "in_progress") {
        await runReviewer(issue, token);
      }
    }
  } catch (e) {
    console.error("[Heartbeat] Reviewer check failed:", e);
  }

  // Check Drafter inbox
  try {
    const drafterIssues = await getAgentInbox(DRAFTER_ID, token);
    for (const issue of drafterIssues) {
      if (issue.status === "todo" || issue.status === "in_progress") {
        await runDrafter(issue, token);
      }
    }
  } catch (e) {
    console.error("[Heartbeat] Drafter check failed:", e);
  }
}

// --- Reviewer agent ---

async function runReviewer(issue: { id: string; title: string; description: string }, token: string | null) {
  const model = getModel();

  let home: string;
  try {
    const { homeDir } = await import("@tauri-apps/api/path");
    home = await homeDir();
  } catch {
    home = "/Users/aialchemy";
  }

  // Checkout
  try {
    await checkout(issue.id, REVIEWER_ID, token);
  } catch (e) {
    console.error("[Reviewer] Checkout failed (409 = someone else has it):", e);
    return; // Never retry a 409
  }

  // Extract parsed text path from issue description
  const parsedPathMatch = issue.description?.match(/Parsed text:\s*(.+)/);
  const originalMatch = issue.description?.match(/Original:\s*(.+)/);
  if (!parsedPathMatch) {
    await patchIssue(issue.id, { status: "blocked", comment: "No parsed text path in issue description" }, token);
    return;
  }

  const parsedPath = parsedPathMatch[1].trim();
  const originalPath = originalMatch?.[1]?.trim() || "";
  const filename = originalPath.split("/").pop() || issue.title.replace("Review: ", "");
  const baseName = filename.replace(/\.[^.]+$/, "");

  // Read parsed text
  let docText: string;
  try {
    const { readFileText } = await import("./tauri");
    docText = await readFileText(parsedPath);
  } catch {
    await patchIssue(issue.id, { status: "blocked", comment: `Cannot read parsed text: ${parsedPath}` }, token);
    return;
  }

  // Classify
  let docType = "unknown";
  let docSubtype = "unclassified";
  try {
    const classifyResponse = await chatCompletion(model, [
      { role: "system", content: CLASSIFIER_PROMPT },
      { role: "user", content: `Classify this document.\n\nFilename: ${filename}\n\n${docText.slice(0, 3000)}` },
    ]);
    let jsonStr = classifyResponse.message.content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    }
    const c = JSON.parse(jsonStr);
    docType = c.type || "unknown";
    docSubtype = c.subtype || "unclassified";
  } catch {}

  // Review
  const reviewPrompt = (docType === "contract" || docType === "nda")
    ? CONTRACT_REVIEW_PROMPT
    : GENERIC_REVIEW_PROMPT(docType);

  const reviewResponse = await chatCompletion(model, [
    { role: "system", content: reviewPrompt },
    { role: "user", content: `Review this document.\n\nDocument: ${filename}\n\n---\n\n${docText}` },
  ]);

  // Write deliverable
  const reviewPath = `${home}/paralegal/deliverables/review-${baseName}.md`;
  const reviewContent = `# Contract Review: ${filename}\n\n**Date:** ${new Date().toLocaleString()}\n**Type:** ${docType} (${docSubtype})\n\n---\n\n${reviewResponse.message.content}`;
  await writeFileText(reviewPath, reviewContent);

  // Comment on issue
  await postComment(
    issue.id,
    `## Review Complete\n\n- **Type:** ${docType} (${docSubtype})\n- **Deliverable:** \`review-${baseName}.md\`\n- **Path:** ${reviewPath}`,
    REVIEWER_ID,
    token
  );

  // Create issue for Drafter — handoff with review + parsed paths
  await createIssue(
    `Summary: ${filename}`,
    `Generate executive summary.\n\nParsed text: ${parsedPath}\nReview: ${reviewPath}\nOriginal: ${originalPath}`,
    DRAFTER_ID,
    REVIEWER_ID,
    token
  );

  // Mark done
  await patchIssue(issue.id, { status: "done" }, token);
}

// --- Drafter agent ---

async function runDrafter(issue: { id: string; title: string; description: string }, token: string | null) {
  const model = getModel();

  let home: string;
  try {
    const { homeDir } = await import("@tauri-apps/api/path");
    home = await homeDir();
  } catch {
    home = "/Users/aialchemy";
  }

  // Checkout
  try {
    await checkout(issue.id, DRAFTER_ID, token);
  } catch (e) {
    console.error("[Drafter] Checkout failed:", e);
    return;
  }

  // Extract paths from issue description
  const parsedPathMatch = issue.description?.match(/Parsed text:\s*(.+)/);
  const reviewPathMatch = issue.description?.match(/Review:\s*(.+)/);
  const originalMatch = issue.description?.match(/Original:\s*(.+)/);

  if (!reviewPathMatch) {
    await patchIssue(issue.id, { status: "blocked", comment: "No review path in issue description" }, token);
    return;
  }

  const reviewPath = reviewPathMatch[1].trim();
  const parsedPath = parsedPathMatch?.[1]?.trim();
  const originalPath = originalMatch?.[1]?.trim() || "";
  const filename = originalPath.split("/").pop() || issue.title.replace("Summary: ", "");
  const baseName = filename.replace(/\.[^.]+$/, "");

  // Read review
  let reviewContent: string;
  try {
    const { readFileText } = await import("./tauri");
    reviewContent = await readFileText(reviewPath);
  } catch {
    await patchIssue(issue.id, { status: "blocked", comment: `Cannot read review: ${reviewPath}` }, token);
    return;
  }

  // Read parsed text for additional context
  let docText = "";
  if (parsedPath) {
    try {
      const { readFileText } = await import("./tauri");
      docText = await readFileText(parsedPath);
    } catch {}
  }

  // Generate summary
  const summaryResponse = await chatCompletion(model, [
    { role: "system", content: SUMMARY_PROMPT },
    {
      role: "user",
      content: `Summarize this document incorporating review findings.\n\n---REVIEW---\n${reviewContent}\n---END REVIEW---\n\nOriginal (first 8000 chars):\n---DOCUMENT---\n${docText.slice(0, 8000)}\n---END DOCUMENT---`,
    },
  ]);

  // Write deliverable
  const summaryPath = `${home}/paralegal/deliverables/summary-${baseName}.md`;
  const summaryContent = `# Summary: ${filename}\n\n**Date:** ${new Date().toLocaleString()}\n\n---\n\n${summaryResponse.message.content}`;
  await writeFileText(summaryPath, summaryContent);

  // Comment on issue
  await postComment(
    issue.id,
    `## Summary Complete\n\n- **Deliverable:** \`summary-${baseName}.md\`\n- **Path:** ${summaryPath}`,
    DRAFTER_ID,
    token
  );

  // Mark done
  await patchIssue(issue.id, { status: "done" }, token);
}
