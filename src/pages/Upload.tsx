import { useState } from "react";
import FileDropZone from "../components/FileDropZone";
import DocumentViewer from "../components/DocumentViewer";
import Markdown from "../components/Markdown";
import { parseDocument, writeFileText, writeFileBinary } from "../lib/tauri";
import { reviewDocument, draftMemo } from "../lib/ollama";
import type { ParsedDocument } from "../types";

type TaskType = "review" | "memo" | "summary";

export default function Upload() {
  const [parsed, setParsed] = useState<ParsedDocument | null>(null);
  const [instructions, setInstructions] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("review");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setError(null);
    setResult(null);

    try {
      const home = await getHome();
      const inboxPath = `${home}/paralegal/inbox/${file.name}`;
      const isText = file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md");

      if (isText) {
        // Text files: read as string, write as text
        const text = await file.text();
        await writeFileText(inboxPath, text);
      } else {
        // Binary files (PDF, DOCX, images): read as bytes, write binary
        const buffer = await file.arrayBuffer();
        const bytes = Array.from(new Uint8Array(buffer));
        await writeFileBinary(inboxPath, bytes);
      }

      // Parse with LiteParse (handles PDF, DOCX, TXT, images)
      const doc = await parseDocument(inboxPath);
      setParsed(doc);
    } catch (e) {
      setError(`Failed to process file: ${e}`);
    }
  };

  const handleProcess = async () => {
    if (!parsed?.text || !instructions.trim()) return;
    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      let output: string;
      if (taskType === "review") {
        output = await reviewDocument(parsed.text, instructions);
      } else {
        output = await draftMemo(parsed.text, instructions);
      }
      setResult(output);

      const home = await getHome();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const delivPath = `${home}/paralegal/deliverables/${taskType}-${timestamp}.md`;
      await writeFileText(
        delivPath,
        `# ${taskType.charAt(0).toUpperCase() + taskType.slice(1)}: ${parsed.filename}\n\n**Instructions:** ${instructions}\n\n---\n\n${output}`
      );
    } catch (e) {
      setError(`Processing failed: ${e}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold mb-6">Upload Document</h2>

      <FileDropZone
        onFileDrop={handleFiles}
        accept=".pdf,.docx,.txt,.md,.doc"
      />

      {parsed && (
        <div className="mt-6 space-y-4">
          <DocumentViewer document={parsed} />

          <div className="border dark:border-dark-border rounded-lg p-4 space-y-4 bg-white dark:bg-dark-surface">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Task Type
              </label>
              <div className="flex gap-2">
                {(["review", "memo", "summary"] as TaskType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTaskType(t)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      taskType === t
                        ? "bg-accent text-white"
                        : "bg-gray-100 dark:bg-dark-card text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-border"
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Instructions
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g., Review this contract for risks and missing clauses..."
                className="w-full px-3 py-2 border dark:border-dark-border rounded-lg text-sm resize-none h-24 bg-white dark:bg-dark-card dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent/50 dark:placeholder-gray-500"
              />
            </div>

            <button
              onClick={handleProcess}
              disabled={processing || !instructions.trim()}
              className="w-full py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light disabled:opacity-50 transition-colors"
            >
              {processing ? "Processing..." : `Run ${taskType}`}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {result && (
            <div className="border dark:border-dark-border rounded-lg overflow-hidden">
              <div className="bg-green-50 dark:bg-green-900/20 px-4 py-2 border-b dark:border-dark-border">
                <span className="font-medium text-sm text-green-800 dark:text-green-400">Result</span>
              </div>
              <div className="p-4 max-h-96 overflow-auto">
                <Markdown content={result} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

async function getHome(): Promise<string> {
  try {
    const { homeDir } = await import("@tauri-apps/api/path");
    return await homeDir();
  } catch {
    return "/Users/" + (typeof window !== "undefined" ? "aialchemy" : "user");
  }
}
