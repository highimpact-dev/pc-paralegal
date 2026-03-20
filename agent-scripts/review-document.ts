#!/usr/bin/env bun
/**
 * Document review script invoked by Paperclip agent via process adapter.
 * Reads a document, sends it to Ollama for analysis, writes deliverable.
 *
 * Usage: bun run review-document.ts <document-path> [instructions]
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { basename, join } from "path";
import { chat } from "./shared/ollama-client";
import { DOCUMENT_REVIEWER_PROMPT } from "./shared/prompts";

const [docPath, ...instructionParts] = process.argv.slice(2);
const instructions = instructionParts.join(" ") || "Review this document thoroughly";

if (!docPath) {
  console.error("Usage: bun run review-document.ts <document-path> [instructions]");
  process.exit(1);
}

const docText = readFileSync(docPath, "utf-8");
const docName = basename(docPath);

console.log(`Reviewing: ${docName}`);
console.log(`Instructions: ${instructions}`);

const response = await chat([
  { role: "system", content: DOCUMENT_REVIEWER_PROMPT },
  {
    role: "user",
    content: `Please review the following document.\n\nInstructions: ${instructions}\n\nDocument: ${docName}\n\n---\n\n${docText}`,
  },
]);

// Write deliverable
const home = process.env.HOME || "/tmp";
const delivDir = join(home, "paralegal", "deliverables");
mkdirSync(delivDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputPath = join(delivDir, `review-${timestamp}.md`);
const output = `# Document Review: ${docName}\n\n**Instructions:** ${instructions}\n**Date:** ${new Date().toLocaleString()}\n\n---\n\n${response}`;

writeFileSync(outputPath, output);
console.log(`Deliverable written to: ${outputPath}`);
