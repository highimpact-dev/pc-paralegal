#!/usr/bin/env bun
/**
 * Reviewer Agent
 *
 * Receives pre-parsed document text from the Director.
 * Classifies the document, runs the appropriate review skill,
 * writes the deliverable, posts results, marks done.
 *
 * Usage: bun run agent-scripts/reviewer-agent.ts <parsed-text-path> <original-filename> <issue-id>
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { basename, join, extname } from "path";
import { classifyDocument } from "./shared/classifier";
import { reviewContract } from "./skills/contract-review";
import { chat } from "./shared/ollama-client";
import {
  AGENTS,
  checkoutIssue,
  postComment,
  markDone,
} from "./shared/paperclip-client";

const [parsedTextPath, originalFilename, issueId] = process.argv.slice(2);
if (!parsedTextPath || !originalFilename || !issueId) {
  console.error("Usage: reviewer-agent.ts <parsed-text-path> <original-filename> <issue-id>");
  process.exit(1);
}

const filename = originalFilename;
const docName = basename(filename, extname(filename));
const home = process.env.HOME || "/tmp";
const delivDir = join(home, "paralegal", "deliverables");
mkdirSync(delivDir, { recursive: true });

// Step 1: Check out the issue
console.error(`[Reviewer] Checking out issue ${issueId}`);
try {
  await checkoutIssue(issueId, AGENTS.reviewer);
} catch (e) {
  console.error(`[Reviewer] Checkout warning: ${e}`);
}

// Step 2: Read pre-parsed text (Director already parsed and saved it)
console.error(`[Reviewer] Reading parsed text: ${parsedTextPath}`);
let docText: string;
try {
  docText = readFileSync(parsedTextPath, "utf-8");
} catch {
  const error = `Cannot read parsed text: ${parsedTextPath}`;
  await postComment(issueId, `**Error:** ${error}`, AGENTS.reviewer);
  await markDone(issueId);
  console.log(JSON.stringify({ success: false, error }));
  process.exit(1);
}

// Step 3: Classify
console.error(`[Reviewer] Classifying: ${filename}`);
const classification = await classifyDocument(docText, filename);
console.error(
  `[Reviewer] Type: ${classification.type} (${classification.subtype}) [${classification.confidence}]`
);

// Step 4: Run appropriate review skill
console.error(`[Reviewer] Reviewing as: ${classification.type}`);
let reviewResult: string;

switch (classification.type) {
  case "contract":
  case "nda":
    reviewResult = await reviewContract(docText, filename);
    break;
  default:
    reviewResult = await genericReview(docText, filename, classification.type);
    break;
}

// Step 5: Write review deliverable
const reviewPath = join(delivDir, `review-${docName}.md`);
writeFileSync(reviewPath, reviewResult);
console.error(`[Reviewer] Written: review-${docName}.md`);

// Step 6: Post comment to issue
const commentBody = [
  `**Review complete:** ${filename}`,
  `**Type:** ${classification.type} (${classification.subtype})`,
  `**Confidence:** ${classification.confidence}`,
  `**Deliverable:** \`review-${docName}.md\``,
  `**Review path:** \`${reviewPath}\``,
].join("\n");

try {
  await postComment(issueId, commentBody, AGENTS.reviewer);
} catch (e) {
  console.error(`[Reviewer] Comment warning: ${e}`);
}

// Step 7: Mark done
try {
  await markDone(issueId);
} catch (e) {
  console.error(`[Reviewer] Mark done warning: ${e}`);
}

console.error(`[Reviewer] Done: ${filename}`);

// Output result for pipeline orchestrator
console.log(
  JSON.stringify({
    success: true,
    filename,
    document_type: classification.type,
    document_subtype: classification.subtype,
    confidence: classification.confidence,
    review_path: reviewPath,
    review_file: `review-${docName}.md`,
    doc_text_length: docText.length,
  })
);

// --- Helpers ---

async function genericReview(
  text: string,
  name: string,
  docType: string
): Promise<string> {
  const response = await chat(
    [
      {
        role: "system",
        content: `You are a paralegal reviewing a ${docType} document. Provide a thorough analysis with:

1. **Document Overview**: What this document is, parties involved, key dates
2. **Key Provisions**: The most important terms and conditions
3. **Issues & Concerns**: Anything problematic, unusual, or requiring attention
4. **Missing Elements**: Standard provisions for this document type that are absent
5. **Recommendations**: Specific next steps

Be specific. Reference exact sections and language.`,
      },
      {
        role: "user",
        content: `Review this ${docType} document.\n\nDocument: ${name}\n\n---\n\n${text}`,
      },
    ],
    { num_ctx: 16384 }
  );

  return `# Document Review: ${name}\n\n**Date:** ${new Date().toLocaleString()}\n**Type:** ${docType}\n**Skill:** generic-review\n\n---\n\n${response}`;
}
