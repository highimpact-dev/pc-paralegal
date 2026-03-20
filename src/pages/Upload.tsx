import { useState } from "react";
import FileDropZone from "../components/FileDropZone";
import DocumentViewer from "../components/DocumentViewer";
import { parseDocument, writeFileText } from "../lib/tauri";
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
      // Write file to inbox via Tauri (files from browser need to go through the backend)
      const reader = new FileReader();
      reader.onload = async () => {
        const text = reader.result as string;
        const home = await getHome();
        const inboxPath = `${home}/paralegal/inbox/${file.name}`;

        // For text files, write directly. For binary, we'd need a different approach.
        // POC: handle text-based files
        if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
          await writeFileText(inboxPath, text);
          const doc = await parseDocument(inboxPath);
          setParsed(doc);
        } else {
          // For PDF/DOCX, we need the file path. In Tauri, dropped files give us the path.
          // For now, show a note about using the native file dialog
          setParsed({
            filename: file.name,
            text: `[Binary file: ${file.name}]\n\nFor PDF/DOCX files, the document will be parsed using LiteParse when processed through the native file system.\n\nFile size: ${(file.size / 1024).toFixed(1)} KB`,
            metadata: { type: file.type, size: file.size },
            pages: null,
          });
        }
      };
      reader.readAsText(file);
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

      // Save deliverable
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
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload Document</h2>

      <FileDropZone
        onFileDrop={handleFiles}
        accept=".pdf,.docx,.txt,.md,.doc"
      />

      {parsed && (
        <div className="mt-6 space-y-4">
          <DocumentViewer document={parsed} />

          <div className="border rounded-lg p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instructions
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g., Review this contract for risks and missing clauses..."
                className="w-full px-3 py-2 border rounded-lg text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-accent/50"
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
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {result && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-green-50 px-4 py-2 border-b">
                <span className="font-medium text-sm text-green-800">Result</span>
              </div>
              <div className="p-4 max-h-96 overflow-auto">
                <pre className="text-sm whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
                  {result}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

async function getHome(): Promise<string> {
  // In Tauri context, we can get the home dir
  // Fallback to a reasonable default
  try {
    const { homeDir } = await import("@tauri-apps/api/path");
    return await homeDir();
  } catch {
    return "/Users/" + (typeof window !== "undefined" ? "aialchemy" : "user");
  }
}
