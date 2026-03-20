#!/usr/bin/env bun
/**
 * Drafter Agent (Summarizer)
 *
 * Receives pre-parsed document text from the Director.
 * Reads the review deliverable, generates an executive summary
 * incorporating review findings, writes the deliverable, posts results, marks done.
 *
 * Usage: bun run agent-scripts/drafter-agent.ts <parsed-text-path> <original-filename> <review-path> <issue-id>
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { basename, join, extname } from "path";
import { chat } from "./shared/ollama-client";
import {
  AGENTS,
  checkoutIssue,
  postComment,
  markDone,
} from "./shared/paperclip-client";

const [parsedTextPath, originalFilename, reviewPath, issueId] = process.argv.slice(2);
if (!parsedTextPath || !originalFilename || !reviewPath || !issueId) {
  console.error(
    "Usage: drafter-agent.ts <parsed-text-path> <original-filename> <review-path> <issue-id>"
  );
  process.exit(1);
}

const filename = originalFilename;
const docName = basename(filename, extname(filename));
const home = process.env.HOME || "/tmp";
const delivDir = join(home, "paralegal", "deliverables");
mkdirSync(delivDir, { recursive: true });

// Step 1: Check out the issue
console.error(`[Drafter] Checking out issue ${issueId}`);
try {
  await checkoutIssue(issueId, AGENTS.drafter);
} catch (e) {
  console.error(`[Drafter] Checkout warning: ${e}`);
}

// Step 2: Read the review
console.error(`[Drafter] Reading review: ${reviewPath}`);
let reviewContent: string;
try {
  reviewContent = readFileSync(reviewPath, "utf-8");
} catch {
  const error = `Cannot read review file: ${reviewPath}`;
  await postComment(issueId, `**Error:** ${error}`, AGENTS.drafter);
  await markDone(issueId);
  console.log(JSON.stringify({ success: false, error }));
  process.exit(1);
}

// Step 3: Read pre-parsed text (Director already parsed it)
console.error(`[Drafter] Reading parsed text: ${parsedTextPath}`);
let docText: string;
try {
  docText = readFileSync(parsedTextPath, "utf-8");
} catch {
  docText = ""; // Summary can still work from review alone
}

// Step 4: Generate summary incorporating review findings
console.error(`[Drafter] Generating summary: ${filename}`);

const summaryResponse = await chat(
  [
    {
      role: "system",
      content: `You are a paralegal writing an executive summary of a document that has already been reviewed. Your summary should:

1. **Executive Summary** (2-3 sentences): What this document is and its primary purpose
2. **Parties**: Who is involved and their roles
3. **Key Terms**: The most important terms in plain language (dates, amounts, obligations)
4. **Issues Found**: Summarize the issues identified in the review, organized by severity (CRITICAL, HIGH, MEDIUM, LOW). Include the specific clause references from the review.
5. **Bottom Line**: One paragraph assessment — is this document ready to sign, needs revision, or has serious problems? What are the 2-3 most important things to address?

Write for a busy attorney who needs the essential facts in 60 seconds. No legal jargon where plain language works. Be direct about the risk level.`,
    },
    {
      role: "user",
      content: `Write an executive summary for this document.

The document has already been reviewed. Incorporate the review findings:

---REVIEW---
${reviewContent}
---END REVIEW---

Original document (first 8000 chars):
---DOCUMENT---
${docText.slice(0, 8000)}
---END DOCUMENT---`,
    },
  ],
  { num_ctx: 16384 }
);

// Step 5: Write summary deliverable
const summaryPath = join(delivDir, `summary-${docName}.md`);
const summaryContent = `# Summary: ${filename}\n\n**Date:** ${new Date().toLocaleString()}\n**Based on:** review-${docName}.md\n\n---\n\n${summaryResponse}`;
writeFileSync(summaryPath, summaryContent);
console.error(`[Drafter] Written: summary-${docName}.md`);

// Step 6: Post comment to issue
const commentBody = [
  `**Summary complete:** ${filename}`,
  `**Deliverable:** \`summary-${docName}.md\``,
  `**Summary path:** \`${summaryPath}\``,
  `**Based on review:** \`review-${docName}.md\``,
].join("\n");

try {
  await postComment(issueId, commentBody, AGENTS.drafter);
} catch (e) {
  console.error(`[Drafter] Comment warning: ${e}`);
}

// Step 7: Mark done
try {
  await markDone(issueId);
} catch (e) {
  console.error(`[Drafter] Mark done warning: ${e}`);
}

console.error(`[Drafter] Done: ${filename}`);

// Output result for pipeline orchestrator
console.log(
  JSON.stringify({
    success: true,
    filename,
    summary_path: summaryPath,
    summary_file: `summary-${docName}.md`,
  })
);
