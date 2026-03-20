import { useState, useEffect } from "react";
import FileDropZone from "../components/FileDropZone";
import DocumentViewer from "../components/DocumentViewer";
import Markdown from "../components/Markdown";
import { parseDocument, writeFileText, writeFileBinary, listDirectory, deleteFile, archiveFile, restoreFile, clearChatHistory } from "../lib/tauri";
import { reviewDocument, draftMemo } from "../lib/ollama";
import type { ParsedDocument, FileEntry } from "../types";

type TaskType = "review" | "memo" | "summary";

export default function Upload() {
  const [parsed, setParsed] = useState<ParsedDocument | null>(null);
  const [instructions, setInstructions] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("review");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<FileEntry[]>([]);
  const [archivedUploads, setArchivedUploads] = useState<FileEntry[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const loadUploads = () => {
    listDirectory("inbox").then(setUploads).catch(() => {});
    listDirectory("archive").then((all) => {
      // Only show non-deliverable files (uploads are PDFs, DOCXs, etc.)
      setArchivedUploads(all.filter((f) => !f.name.startsWith("review-") && !f.name.startsWith("memo-") && !f.name.startsWith("summary-")));
    }).catch(() => {});
  };

  useEffect(() => { loadUploads(); }, []);

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
        const text = await file.text();
        await writeFileText(inboxPath, text);
      } else {
        const buffer = await file.arrayBuffer();
        const bytes = Array.from(new Uint8Array(buffer));
        await writeFileBinary(inboxPath, bytes);
      }

      const doc = await parseDocument(inboxPath);
      setParsed(doc);
      loadUploads();
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
      const baseName = parsed.filename.replace(/\.[^.]+$/, "");
      const delivPath = `${home}/paralegal/deliverables/${taskType}-${baseName}.md`;
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

  const handleArchive = async (file: FileEntry) => {
    await archiveFile(file.path);
    clearChatHistory(file.path);
    loadUploads();
  };

  const handleDelete = async (file: FileEntry) => {
    if (pendingDelete !== file.path) {
      setPendingDelete(file.path);
      setTimeout(() => setPendingDelete(null), 3000);
      return;
    }
    setPendingDelete(null);
    try {
      await deleteFile(file.path);
      clearChatHistory(file.path);
    } catch (e) { console.error("Delete failed:", e); }
    loadUploads();
  };

  const handleRestore = async (file: FileEntry) => {
    await restoreFile(file.path, "inbox");
    loadUploads();
  };

  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold mb-6">Upload Document</h2>

      <FileDropZone onFileDrop={handleFiles} accept=".pdf,.docx,.txt,.md,.doc" />

      {parsed && (
        <div className="mt-6 space-y-4">
          <DocumentViewer document={parsed} />

          <div className="border dark:border-dark-border rounded-lg p-4 space-y-4 bg-white dark:bg-dark-surface">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Task Type</label>
              <div className="flex gap-2">
                {(["review", "memo", "summary"] as TaskType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTaskType(t)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      taskType === t ? "bg-accent text-white" : "bg-gray-100 dark:bg-dark-card text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-border"
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instructions</label>
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

      {/* Uploads list */}
      {uploads.length > 0 && (
        <div className="mt-8">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">Uploaded Documents</h3>
          <div className="space-y-2">
            {uploads.map((f) => (
              <FileRow key={f.path} file={f} onArchive={handleArchive} onDelete={handleDelete} pendingDelete={pendingDelete} />
            ))}
          </div>
        </div>
      )}

      {/* Archived uploads */}
      {archivedUploads.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <svg className={`w-3 h-3 transition-transform ${showArchived ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Archived Uploads ({archivedUploads.length})
          </button>
          {showArchived && (
            <div className="mt-3 space-y-2">
              {archivedUploads.map((f) => (
                <ArchivedRow key={f.path} file={f} onRestore={handleRestore} onDelete={handleDelete} pendingDelete={pendingDelete} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FileRow({ file, onArchive, onDelete, pendingDelete }: { file: FileEntry; onArchive: (f: FileEntry) => void; onDelete: (f: FileEntry) => void; pendingDelete: string | null }) {
  const isArmed = pendingDelete === file.path;
  const ext = file.name.split(".").pop()?.toUpperCase() || "";
  return (
    <div className="group text-sm p-3 bg-gray-50 dark:bg-dark-card rounded-lg flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-dark-border rounded text-gray-500 dark:text-gray-400 flex-shrink-0">{ext}</span>
        <span className="truncate">{file.name}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
        {isArmed ? (
          <button onClick={() => onDelete(file)} className="text-[10px] font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded animate-pulse">
            Confirm
          </button>
        ) : (
          <>
            <span className="text-xs text-gray-400">{file.modified ? new Date(file.modified * 1000).toLocaleDateString() : ""}</span>
            <button onClick={() => onArchive(file)} title="Archive" className="p-1 rounded text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
            </button>
            <button onClick={() => onDelete(file)} title="Delete" className="p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ArchivedRow({ file, onRestore, onDelete, pendingDelete }: { file: FileEntry; onRestore: (f: FileEntry) => void; onDelete: (f: FileEntry) => void; pendingDelete: string | null }) {
  const isArmed = pendingDelete === file.path;
  return (
    <div className="group text-sm p-2 bg-gray-50/50 dark:bg-dark-card/50 rounded flex items-center justify-between border border-dashed border-gray-200 dark:border-dark-border">
      <div className="flex items-center gap-2 min-w-0">
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
        <span className="truncate text-gray-500 dark:text-gray-400">{file.name}</span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
        {isArmed ? (
          <button onClick={() => onDelete(file)} className="text-[10px] font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded animate-pulse">
            Confirm
          </button>
        ) : (
          <>
            <button onClick={() => onRestore(file)} title="Restore" className="p-1 rounded text-gray-400 hover:text-green-600 dark:hover:text-green-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <button onClick={() => onDelete(file)} title="Delete" className="p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </>
        )}
      </div>
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
