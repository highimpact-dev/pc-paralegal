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
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[Paperclip API] ${res.status} ${options?.method || "GET"} ${path}: ${body}`);
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json();
}

async function getAgentInbox(agentId: string, token: string | null) {
  const data = await api(`/companies/${COMPANY_ID}/issues`, token);
  const all = data.issues || [];
  // Filter client-side: assigned to this agent, status todo or in_progress
  return all.filter(
    (i: { assigneeAgentId: string; status: string }) =>
      i.assigneeAgentId === agentId &&
      (i.status === "todo" || i.status === "in_progress")
  );
}

async function checkout(issueId: string, _agentId: string, token: string | null) {
  // Set status to in_progress (simplified Paperclip — no /checkout endpoint)
  return patchIssue(issueId, { status: "in_progress" }, token);
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
  return api(`/companies/${COMPANY_ID}/projects/${PROJECT_ID}/issues`, token, {
    method: "POST",
    body: JSON.stringify({
      title,
      description,
      priority: "high",
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

const CONTRACT_REVIEW_PROMPT = `You are an expert paralegal performing a comprehensive contract review for attorney supervision. You apply the same rigor as enterprise legal AI platforms with 1,400+ extraction fields. Your reviews are structured, actionable, and cite specific language.

## Review Structure

### 1. Document Overview

| Field | Details |
|-------|---------|
| Document Type | [MSA, NDA, Employment, SaaS, Vendor, Lease, SOW, Amendment, etc.] |
| Parties | [Full legal names, entity types (Corp/LLC/LP), defined abbreviations] |
| Effective Date | [Date or "not specified"] |
| Term | [Duration, auto-renewal mechanism, notice period for non-renewal] |
| Governing Law | [State/jurisdiction and exclusive venue] |
| Signatory Authority | [Named signatories and their titles, or "not specified"] |

Flag: incorrect entity names, missing entity types, unsigned signature blocks, or discrepancies between parties named in the preamble vs. the signature block.

### 2. Risk Assessment

Score each material provision across five risk dimensions:

| # | Clause/Section | Risk Category | Risk Level | Issue | Financial Exposure | Recommendation |
|---|---|---|---|---|---|---|
| 1 | [Section ref] | Financial/Legal/Compliance/Operational/Reputational | CRITICAL/HIGH/MEDIUM/LOW | [Specific issue] | [Estimated exposure or "unquantifiable"] | [Specific action] |

Risk Categories:
- **Financial**: Monetary loss from unfavorable pricing, uncapped liability, hidden fees, penalties, or missed deadlines
- **Legal**: Litigation exposure, defective IP clauses, unenforceable terms, or missing dispute resolution
- **Compliance**: Regulatory violations (GDPR, HIPAA, SOX, state-specific), data privacy gaps, or missing required provisions
- **Operational**: Administration errors, unclear deliverables, unmeasurable KPIs, or ambiguous scope
- **Reputational**: Brand damage from public disputes, partner failures, or unfavorable public terms

### 3. Clause-by-Clause Analysis

For each clause: (a) quote the exact language, (b) assess against market-standard terms, (c) flag deviations, (d) provide specific fallback language or negotiation position. Mark absent sections explicitly.

**Parties & Authority**
- Are all parties correctly identified with full legal names and entity types?
- Is signatory authority confirmed? Could a signatory bind the entity?
- Are there undisclosed principals, agents, or affiliates?

**Scope of Work / Deliverables**
- Are deliverables or services described with measurable standards?
- Are acceptance criteria defined?
- Are timelines and milestones specified with consequences for delay?

**Term & Termination**
- Duration and commencement trigger
- Renewal: auto-renewal terms, opt-out notice period, renewal term length
- Termination for cause: what constitutes cause, cure period length, notice requirements
- Termination for convenience: which parties have this right, notice period, wind-down obligations
- Effect of termination: survival clauses, transition assistance, data return/destruction
- Early termination penalties or fees

**Payment & Financial**
- Payment amount, schedule, and method (net 30/60/90)
- Late payment penalties, interest rate on overdue amounts
- Price adjustment/escalation mechanisms (CPI, annual cap)
- Expense reimbursement scope and approval process
- Tax responsibility allocation
- Audit rights (frequency, notice, scope, cost allocation)
- Hidden fees: setup fees, minimum commitments, overage charges
- Currency specification for cross-border deals

**Indemnification**
- Mutual or one-sided? Which party bears greater exposure?
- Scope: what claims are covered (IP infringement, negligence, breach, third-party claims)
- Caps: per-incident and aggregate limits, or uncapped
- Carve-outs from caps (willful misconduct, gross negligence, confidentiality breach)
- Defense and control: who controls defense of claims, consent to settle
- Notice requirements for indemnification claims
- Insurance requirements tied to indemnification

**Limitation of Liability**
- Cap structure: fixed dollar amount, contract value multiple, or per-period
- Consequential damages waiver: mutual? Exclusions listed?
- Categories excluded from cap (IP, confidentiality, indemnification, data breach)
- Uncapped liabilities: are there any? Are they reasonable?
- "Super cap" for certain categories vs. general cap

**Intellectual Property**
- Work product ownership: who owns deliverables? Work-for-hire doctrine applicability
- Pre-existing IP: are licenses to pre-existing IP clearly defined?
- License grants: scope (exclusive/non-exclusive), territory, perpetuity, sublicensing rights
- Background IP protections
- Open source obligations and contamination risk
- Moral rights waiver where applicable

**Confidentiality**
- Definition scope: is it appropriately broad but not overbroad?
- Exclusions: public domain, independently developed, rightfully received from third parties
- Permitted disclosures: legal/regulatory compulsion, advisors under NDA
- Duration: during term only, or surviving termination (how long?)
- Return/destruction obligations and certification requirements
- Injunctive relief provision
- Residual knowledge clause (if present, assess scope)

**Representations & Warranties**
- Scope and specificity of each party's reps
- Materiality qualifiers: "material" vs "in all respects" (what standard?)
- Knowledge qualifiers: "to the best of knowledge" (whose knowledge? what inquiry required?)
- Survival period post-termination
- Sole remedy provisions (do they limit rights unfairly?)
- Disclaimer of implied warranties (UCC, merchantability, fitness)
- Supporting schedules: are they complete and attached?

**Dispute Resolution**
- Arbitration vs. litigation (binding? which rules: AAA, JAMS, ICC?)
- Arbitrator selection: number, qualifications, process
- Venue/forum selection: specific court or city
- Prevailing party attorney fees and cost allocation
- Escalation procedure: informal negotiation period before formal proceedings
- Discovery limitations in arbitration
- Injunctive relief carve-out from arbitration
- Confidentiality of proceedings

**Non-Compete & Non-Solicitation**
- Scope of restricted activities
- Geographic limitations: are they reasonable and enforceable in the governing jurisdiction?
- Duration: does it exceed what courts typically enforce (usually 1-2 years)?
- Employee non-solicit vs. customer non-solicit
- Garden leave or compensation during restriction?
- Enforceability analysis under governing law (some states void non-competes)

**Assignment & Change of Control**
- Consent requirements: written consent, not to be unreasonably withheld?
- Permitted assignments: to affiliates, successors, or acquirers?
- Change of control: does it trigger termination rights or renegotiation?
- Anti-assignment provisions: are they mutual?

**Force Majeure**
- Defined events: pandemic, cyberattack, supply chain disruption (modern events included?)
- Notification requirements: timeline and method
- Mitigation obligations
- Duration threshold before termination right triggers
- Financial obligations during force majeure period
- Allocation of risk during extended force majeure

**Data Protection & Privacy**
- Personal data handling obligations (data processor vs. controller)
- Data breach notification: timeline (24/48/72 hours?), to whom, content requirements
- Data processing agreement: incorporated or separate? GDPR Article 28 compliant?
- Cross-border transfer restrictions (SCCs, adequacy decisions, binding corporate rules)
- Data retention and deletion obligations
- Subprocessor approval requirements
- Security standards (SOC 2, ISO 27001, encryption at rest/in transit)

**Insurance**
- Required coverage types: Commercial General Liability, Professional Liability/E&O, Cyber/Tech E&O, Workers' Comp, Auto
- Minimum coverage amounts: are they adequate for the contract value and risk?
- Additional insured requirements
- Certificate of insurance: when due, to whom
- Waiver of subrogation

**Boilerplate (Do Not Skip)**
- Entire agreement/integration clause: does it capture all prior negotiations?
- Amendment requirements: written, signed by both parties?
- Severability: does it preserve the remainder if one clause fails?
- Waiver: does non-enforcement constitute waiver of future rights?
- Notices: method (email acceptable?), addresses specified, deemed received timing
- Counterparts and electronic signature validity

### 4. Missing Provisions

For each standard provision that is absent:
- **What's missing**: Name the provision
- **Risk of omission**: What could happen without it
- **Recommended approach**: Suggest adding it, with direction on scope

Common provisions to check for: limitation of liability, indemnification, confidentiality, IP ownership, data protection, force majeure, dispute resolution, insurance, non-solicitation, audit rights, anti-corruption/FCPA, export control, most-favored-customer, step-in rights, business continuity.

### 5. Red Flags

Flag with specific section references:
- One-sided terms heavily favoring one party (identify which party benefits)
- Broad discretionary language: "sole discretion," "as it deems appropriate," "in its judgment"
- Non-standard definitions that change typical legal meanings
- References to external documents, policies, or exhibits not attached
- Ambiguous or vague language creating interpretive risk (cite the exact vague phrase)
- Unusual remedies, penalties, acceleration, or liquidated damages clauses
- Auto-renewal with no or insufficient opt-out notice
- Unlimited liability exposure for either party
- Missing signature blocks or undated execution
- Inconsistent defined terms (same concept, different names)
- Conflicting provisions within the document
- "Subject to change" or "to be determined" placeholders left in final draft
- Cross-references to sections that don't exist or are incorrectly numbered

### 6. Recommended Actions

Prioritized action items the attorney should take:
- **[CRITICAL]** Must address before execution. Include the section, the issue, and the specific change needed.
- **[HIGH]** Strongly recommend. Include negotiation position and fallback.
- **[MEDIUM]** Worth raising. Include suggested approach.
- **[LOW]** Awareness only. Note for the file.

For each: state the specific action, not "review" or "consider." Example: "Negotiate Section 7.2 to add a mutual liability cap at 2x annual contract value, with carve-outs for IP infringement and confidentiality breach."

## Rules

- Reference specific section numbers and quote exact language in every finding
- Be specific: "Section 7.2 exposes Client to unlimited indemnification for third-party IP claims with no reciprocal obligation from Provider" not "review indemnification"
- If a provision is well-drafted, balanced, and market-standard, state so in one line and move on
- Flag deviations from market standard even if not inherently harmful
- Suggest specific fallback positions and negotiation language, not just "consider revising"
- Assess both parties fairly. Note imbalances in either direction.
- If document quality is poor (template placeholders, inconsistent defined terms, broken cross-references), flag as a global quality issue before the clause analysis
- Check for internal consistency: do defined terms match throughout? Do cross-references resolve correctly? Do obligations in one section conflict with limitations in another?`;

const GENERIC_REVIEW_PROMPT = (docType: string) =>
  `You are a paralegal reviewing a ${docType} document for attorney supervision. Provide a thorough, structured analysis.

### 1. Document Overview

| Field | Details |
|-------|---------|
| Document Type | ${docType} |
| Parties | [All parties with full legal names and roles] |
| Date | [Execution date, effective date, or "not specified"] |
| Governing Law | [Jurisdiction, or "not specified"] |

### 2. Key Provisions
For each major provision, cite the section number and summarize in plain language:
- What obligation or right does it create?
- Who does it apply to?
- What are the consequences of breach?

### 3. Risk Assessment

| # | Section | Risk Level | Issue | Recommendation |
|---|---------|-----------|-------|----------------|

Assess across: Financial risk, Legal risk, Compliance risk, Operational risk.

### 4. Issues & Concerns
For each issue:
- **Section**: [exact reference]
- **Language**: [quote the problematic text]
- **Problem**: [why this is concerning]
- **Remedy**: [specific fix or negotiation position]

### 5. Missing Elements
Standard provisions for a ${docType} that are absent:
- What's missing and why it matters
- Recommended approach for each

### 6. Recommended Actions
Prioritized by severity:
- **[CRITICAL]**: [Section] - [Specific action required]
- **[HIGH]**: [Section] - [Specific action]
- **[MEDIUM]**: [Section] - [Suggested action]

Rules:
- Reference exact section numbers and quote language for every finding
- Be specific, not generic. State what's wrong and what to do about it.
- If a provision is well-drafted, say so in one line
- Flag anything unusual for this document type even if not inherently problematic
- Check for internal consistency: defined terms, cross-references, conflicting provisions`;

const SUMMARY_PROMPT = `You are a paralegal preparing an executive briefing for a supervising attorney. This document has already been reviewed in detail. Your job is to distill the review into a decision-ready briefing.

## Briefing Structure

### 1. Executive Summary
2-3 sentences maximum. State what this document is, what it governs, and the single most important thing the attorney needs to know. Be specific: "3-year MSA for managed IT services with uncapped indemnification exposure" not "a services agreement."

### 2. Parties & Roles

| Party | Full Legal Name | Entity Type | Role |
|-------|----------------|-------------|------|
| [Abbreviation] | [Name] | [Corp/LLC/LP] | [Client/Provider/Licensor/etc.] |

### 3. Key Commercial Terms
Plain language. No jargon. The attorney should understand the deal economics in 30 seconds.

- **Effective Date & Term**: When it starts, how long, renewal mechanism
- **Financial Terms**: Total value, payment schedule, penalties for late payment, price escalation
- **Deliverables/Scope**: What's being provided, with what standards or SLAs
- **Exclusivity or Volume Commitments**: Any minimum purchase, exclusivity, or most-favored-customer terms
- **Termination**: How either party can exit, notice required, early termination cost
- **Non-compete/Restrictions**: What's restricted, for how long, where
- **Insurance Requirements**: What coverage is required and at what limits

### 4. Risk Summary

Organize findings from the review by severity. For each: cite the section, state the risk in plain language, and note the reviewer's recommended action.

**CRITICAL** (must address before signing):
- [Section X.X]: [Risk in plain language]. Recommendation: [specific action]

**HIGH** (strongly recommend addressing):
- [Section X.X]: [Risk]. Recommendation: [action]

**MEDIUM** (worth discussing):
- [Section X.X]: [Risk]. Recommendation: [action]

**LOW** (awareness items):
- [Section X.X]: [Note]

If no issues were found at a severity level, state "None identified."

### 5. Missing Provisions
List any standard provisions the review identified as absent, with one line on why each matters.

### 6. Bottom Line

One paragraph. Be direct. Answer these questions:
- **Ready to sign?** Yes / Yes with minor edits / No, needs negotiation / No, significant issues
- **Overall risk level**: Low / Moderate / Elevated / High
- **Top 3 priorities** if revision is needed (most impactful issues to address first)
- **Deal-breakers?** Any provisions that should be non-negotiable from our side
- **Leverage assessment**: What bargaining position do we have? Are the problematic terms standard for this contract type or unusually aggressive?

## Rules
- Write for a partner or GC who has 60 seconds. Front-load the important information.
- Use plain language. Translate legal terms: "indemnification" becomes "who pays if something goes wrong."
- Be direct about risk. "This is fine" or "this is a problem" are better than hedging.
- Every finding must reference a specific section number from the review.
- If the review found no significant issues, say so clearly and affirmatively: "This contract is well-drafted and market-standard. Ready to sign."
- Do not add issues that weren't in the review. Your job is to distill, not re-analyze.`;


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
