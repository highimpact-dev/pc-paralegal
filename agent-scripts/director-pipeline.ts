#!/usr/bin/env bun
/**
 * Director Pipeline — Orchestrator
 *
 * The Director agent coordinates the document processing pipeline:
 * 1. Creates a review issue → assigns to Reviewer
 * 2. Runs the Reviewer agent
 * 3. Creates a summary issue → assigns to Drafter
 * 4. Runs the Drafter agent
 * 5. Reports final result
 *
 * Each agent checks out its issue, does the work, posts a comment,
 * and marks done — giving us a full audit trail in Paperclip.
 *
 * Usage: bun run agent-scripts/director-pipeline.ts <document-path>
 * Output: JSON result on the last line of stdout
 */
import { basename, extname, join } from "path";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { AGENTS, createIssue } from "./shared/paperclip-client";

const docPath = process.argv[2];
if (!docPath) {
  console.log(
    JSON.stringify({ success: false, error: "Usage: director-pipeline.ts <path>" })
  );
  process.exit(1);
}

const filename = basename(docPath);
const docName = basename(docPath, extname(docPath));
const scriptDir = import.meta.dir;
const home = process.env.HOME || "/tmp";
const parsedDir = join(home, "paralegal", "parsed");
mkdirSync(parsedDir, { recursive: true });

console.error(`[Director] Starting pipeline for: ${filename}`);

// ─── Step 0: Parse document once, save parsed text ───
console.error(`[Director] Parsing document...`);
let docText: string;
const ext = extname(docPath).toLowerCase();

if ([".pdf", ".docx", ".doc", ".rtf"].includes(ext)) {
  // Binary formats MUST go through LiteParse — raw read produces garbage
  try {
    const output = execSync(`lit parse "${docPath}" --format json`, {
      encoding: "utf-8",
      timeout: 60000,
      maxBuffer: 50 * 1024 * 1024, // 50MB for large documents
    });
    const jsonStart = output.indexOf("{");
    if (jsonStart >= 0) {
      const parsed = JSON.parse(output.slice(jsonStart));
      docText =
        parsed.pages?.map((p: { text: string }) => p.text).join("\n\n") || "";
      if (!docText.trim()) {
        console.log(
          JSON.stringify({ success: false, error: `LiteParse returned empty text for ${filename}` })
        );
        process.exit(1);
      }
    } else {
      console.log(
        JSON.stringify({ success: false, error: `LiteParse output not parseable for ${filename}` })
      );
      process.exit(1);
    }
  } catch (e) {
    console.log(
      JSON.stringify({ success: false, error: `LiteParse failed for ${filename}: ${e}` })
    );
    process.exit(1);
  }
} else {
  try {
    docText = readFileSync(docPath, "utf-8");
  } catch {
    console.log(
      JSON.stringify({ success: false, error: `Cannot read ${filename}` })
    );
    process.exit(1);
  }
}

if (!docText.trim()) {
  console.log(
    JSON.stringify({ success: false, error: `${filename} is empty` })
  );
  process.exit(1);
}

// Save parsed text
const parsedPath = join(parsedDir, `${docName}.txt`);
writeFileSync(parsedPath, docText);
console.error(`[Director] Parsed text saved: ${parsedPath} (${docText.length} chars)`);

// ─── Step 1: Create review issue and run Reviewer ───
let reviewIssueId: string | null = null;
try {
  console.error(`[Director] Creating review issue...`);
  const reviewIssue = await createIssue({
    title: `Review: ${filename}`,
    description: `Classify and review document: ${docPath}`,
    priority: "high",
    assigneeAgentId: AGENTS.reviewer,
    createdByAgentId: AGENTS.director,
  });
  reviewIssueId = reviewIssue.id;
  console.error(`[Director] Review issue created: ${reviewIssue.identifier || reviewIssueId}`);
} catch (e) {
  console.error(`[Director] Paperclip unavailable, running without issue tracking: ${e}`);
}

// Run Reviewer agent (pass parsed text path, not raw document)
console.error(`[Director] Dispatching to Reviewer...`);
const reviewArgs = [
  "run",
  join(scriptDir, "reviewer-agent.ts"),
  parsedPath,
  filename,
  reviewIssueId || "no-issue",
];

let reviewResult: {
  success: boolean;
  document_type?: string;
  document_subtype?: string;
  confidence?: string;
  review_path?: string;
  review_file?: string;
  error?: string;
};

try {
  const reviewOutput = execSync(`bun ${reviewArgs.join(" ")}`, {
    encoding: "utf-8",
    timeout: 300000, // 5 min max for review
    env: { ...process.env },
  });

  // Parse the last line as JSON
  const lastLine = reviewOutput.trim().split("\n").pop() || "";
  reviewResult = JSON.parse(lastLine);
} catch (e) {
  const error = `Reviewer agent failed: ${e}`;
  console.error(`[Director] ${error}`);
  console.log(JSON.stringify({ success: false, error }));
  process.exit(1);
}

if (!reviewResult.success) {
  console.error(`[Director] Review failed: ${reviewResult.error}`);
  console.log(JSON.stringify({ success: false, error: reviewResult.error }));
  process.exit(1);
}

console.error(
  `[Director] Review complete: ${reviewResult.document_type} (${reviewResult.document_subtype})`
);

// ─── Step 2: Create summary issue and run Drafter ───
let summaryIssueId: string | null = null;
try {
  console.error(`[Director] Creating summary issue...`);
  const summaryIssue = await createIssue({
    title: `Summary: ${filename}`,
    description: `Generate executive summary incorporating review findings.\nReview: ${reviewResult.review_path}\nDocument: ${docPath}`,
    priority: "medium",
    assigneeAgentId: AGENTS.drafter,
    createdByAgentId: AGENTS.director,
  });
  summaryIssueId = summaryIssue.id;
  console.error(
    `[Director] Summary issue created: ${summaryIssue.identifier || summaryIssueId}`
  );
} catch (e) {
  console.error(`[Director] Paperclip unavailable for summary issue: ${e}`);
}

// Run Drafter agent (pass parsed text path, not raw document)
console.error(`[Director] Dispatching to Drafter...`);
const drafterArgs = [
  "run",
  join(scriptDir, "drafter-agent.ts"),
  parsedPath,
  filename,
  reviewResult.review_path || "",
  summaryIssueId || "no-issue",
];

let drafterResult: {
  success: boolean;
  summary_path?: string;
  summary_file?: string;
  error?: string;
};

try {
  const drafterOutput = execSync(`bun ${drafterArgs.join(" ")}`, {
    encoding: "utf-8",
    timeout: 300000,
    env: { ...process.env },
  });

  const lastLine = drafterOutput.trim().split("\n").pop() || "";
  drafterResult = JSON.parse(lastLine);
} catch (e) {
  const error = `Drafter agent failed: ${e}`;
  console.error(`[Director] ${error}`);
  // Review still succeeded, so partial success
  console.log(
    JSON.stringify({
      success: true,
      partial: true,
      filename,
      document_type: reviewResult.document_type,
      document_subtype: reviewResult.document_subtype,
      confidence: reviewResult.confidence,
      deliverables: [reviewResult.review_file],
      error: `Summary failed: ${error}`,
    })
  );
  process.exit(0);
}

if (!drafterResult.success) {
  console.error(`[Director] Summary failed: ${drafterResult.error}`);
  console.log(
    JSON.stringify({
      success: true,
      partial: true,
      filename,
      document_type: reviewResult.document_type,
      document_subtype: reviewResult.document_subtype,
      confidence: reviewResult.confidence,
      deliverables: [reviewResult.review_file],
      error: `Summary failed: ${drafterResult.error}`,
    })
  );
  process.exit(0);
}

// ─── Done ───
console.error(`[Director] Pipeline complete for: ${filename}`);
console.error(`[Director]   Review:  ${reviewResult.review_file}`);
console.error(`[Director]   Summary: ${drafterResult.summary_file}`);

// Final result (last line — Rust parses this)
console.log(
  JSON.stringify({
    success: true,
    filename,
    document_type: reviewResult.document_type,
    document_subtype: reviewResult.document_subtype,
    confidence: reviewResult.confidence,
    deliverables: [
      reviewResult.review_file,
      drafterResult.summary_file,
    ].filter(Boolean),
  })
);
