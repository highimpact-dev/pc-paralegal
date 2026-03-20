#!/usr/bin/env bun
/**
 * Memo drafting script invoked by Paperclip agent via process adapter.
 * Reads a document, generates a structured memo, writes deliverable.
 *
 * Usage: bun run draft-memo.ts <document-path> [instructions]
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { basename, join } from "path";
import { chat } from "./shared/ollama-client";
import { DOCUMENT_DRAFTER_PROMPT } from "./shared/prompts";

const [docPath, ...instructionParts] = process.argv.slice(2);
const instructions = instructionParts.join(" ") || "Draft a summary memo";

if (!docPath) {
  console.error("Usage: bun run draft-memo.ts <document-path> [instructions]");
  process.exit(1);
}

const docText = readFileSync(docPath, "utf-8");
const docName = basename(docPath);

console.log(`Drafting memo for: ${docName}`);
console.log(`Instructions: ${instructions}`);

const response = await chat([
  { role: "system", content: DOCUMENT_DRAFTER_PROMPT },
  {
    role: "user",
    content: `Draft a memo based on the following document.\n\nInstructions: ${instructions}\n\nDocument: ${docName}\n\n---\n\n${docText}`,
  },
]);

// Write deliverable
const home = process.env.HOME || "/tmp";
const delivDir = join(home, "paralegal", "deliverables");
mkdirSync(delivDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputPath = join(delivDir, `memo-${timestamp}.md`);
const output = `# Memo: ${docName}\n\n**Instructions:** ${instructions}\n**Date:** ${new Date().toLocaleString()}\n\n---\n\n${response}`;

writeFileSync(outputPath, output);
console.log(`Deliverable written to: ${outputPath}`);
