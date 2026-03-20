import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import Markdown from "../components/Markdown";
import {
  getDirectorConfig,
  getInventory,
  readFileText,
  processDocumentManual,
} from "../lib/tauri";
import type { InventoryEntry, DirectorEvent } from "../types";

interface WatchedFile {
  name: string;
  path: string;
  status: "new" | "processing" | "complete" | "error";
  entry?: InventoryEntry;
}

export default function Documents() {
  const [files, setFiles] = useState<WatchedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<WatchedFile | null>(null);
  const [viewType, setViewType] = useState<"parsed" | "review" | "summary">("parsed");
  const [viewContent, setViewContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [watchDir, setWatchDir] = useState<string | null>(null);
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  const loadFiles = async () => {
    try {
      const config = await getDirectorConfig();
      setWatchDir(config.inbox_path);
      if (!config.inbox_path) return;

      // List files in watch directory via Tauri
      const { invoke } = await import("@tauri-apps/api/core");

      let fileList: Array<{ name: string; path: string }> = [];
      try {
        // list_directory works with paralegal subdirs, so for arbitrary paths
        // we need to read the inventory + check for known files
        const inventory = await getInventory();
        const inventoryMap = new Map(
          inventory.map((e) => [e.source_path, e])
        );

        // Get files from inventory that are in the watch dir
        const inventoryFiles = inventory
          .filter((e) => e.source_path.startsWith(config.inbox_path!))
          .map((e) => ({
            name: e.filename,
            path: e.source_path,
            status: e.status as "complete",
            entry: e,
          }));

        // Also try to list the directory for any new files
        // We'll use a Tauri command that can list any directory
        try {
          const rawFiles: Array<{ name: string; path: string; is_dir: boolean; size: number; modified: number | null }> =
            await invoke("list_arbitrary_directory", { path: config.inbox_path });
          fileList = rawFiles
            .filter((f) => !f.is_dir && !f.name.startsWith(".") && !f.name.startsWith("~"))
            .map((f) => ({ name: f.name, path: f.path }));
        } catch {
          // Command might not exist yet, fall back to inventory only
          fileList = inventoryFiles.map((f) => ({ name: f.name, path: f.path }));
        }

        // Merge: file list + inventory status
        const merged: WatchedFile[] = fileList.map((f) => {
          const inv = inventoryMap.get(f.path);
          const isProcessing = processing.has(f.path);
          return {
            name: f.name,
            path: f.path,
            status: isProcessing ? "processing" : inv?.status === "complete" ? "complete" : "new",
            entry: inv,
          };
        });

        setFiles(merged);
      } catch {
        setFiles([]);
      }
    } catch {
      setFiles([]);
    }
  };

  useEffect(() => {
    loadFiles();
    const interval = setInterval(loadFiles, 5000);

    // Listen for director events
    const unlisten = Promise.all([
      listen<DirectorEvent>("director:processing", (e) => {
        setProcessing((prev) => new Set(prev).add(e.payload.filename));
      }),
      listen<DirectorEvent>("director:complete", (e) => {
        setProcessing((prev) => {
          const next = new Set(prev);
          next.delete(e.payload.filename);
          return next;
        });
        loadFiles();
      }),
      listen<DirectorEvent>("director:error", () => {
        loadFiles();
      }),
    ]);

    return () => {
      clearInterval(interval);
      unlisten.then((fns) => fns.forEach((fn) => fn()));
    };
  }, []);

  const handleViewContent = async (file: WatchedFile, type: "parsed" | "review" | "summary") => {
    setSelectedFile(file);
    setViewType(type);
    setLoadingContent(true);
    setViewContent(null);

    try {
      const home = await getHome();
      let path: string;

      if (type === "parsed") {
        const baseName = file.name.replace(/\.[^.]+$/, "");
        path = `${home}/paralegal/parsed/${baseName}.txt`;
      } else if (type === "review") {
        const baseName = file.name.replace(/\.[^.]+$/, "");
        path = `${home}/paralegal/deliverables/review-${baseName}.md`;
      } else {
        const baseName = file.name.replace(/\.[^.]+$/, "");
        path = `${home}/paralegal/deliverables/summary-${baseName}.md`;
      }

      const content = await readFileText(path);
      setViewContent(content);
    } catch {
      setViewContent(`_No ${type} available yet._`);
    }

    setLoadingContent(false);
  };

  const handleProcess = async (file: WatchedFile) => {
    setProcessing((prev) => new Set(prev).add(file.path));
    try {
      await processDocumentManual(file.path);
    } catch (e) {
      console.error("Process failed:", e);
    }
  };

  return (
    <div className="h-full flex gap-6">
      {/* File list */}
      <div className="w-80 flex-shrink-0 flex flex-col">
        <h2 className="text-2xl font-bold mb-4">Documents</h2>

        {!watchDir ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-dark-card rounded-lg p-4">
            No watch folder configured. Go to Settings to select one.
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 truncate" title={watchDir}>
              {watchDir}
            </p>
            <div className="space-y-1.5 flex-1 overflow-auto">
              {files.length === 0 ? (
                <div className="text-sm text-gray-400 p-4 text-center">
                  No documents found
                </div>
              ) : (
                files.map((file) => (
                  <button
                    key={file.path}
                    onClick={() => {
                      setSelectedFile(file);
                      handleViewContent(file, "parsed");
                    }}
                    className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
                      selectedFile?.path === file.path
                        ? "bg-accent/10 dark:bg-accent/20 border border-accent/30"
                        : "bg-gray-50 dark:bg-dark-card hover:bg-gray-100 dark:hover:bg-dark-border border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <StatusDot status={file.status} />
                      <span className="font-medium truncate">{file.name}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-5">
                      {file.entry?.document_type && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-accent/10 dark:bg-accent/20 text-accent rounded">
                          {file.entry.document_type}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400">
                        {file.status === "processing" ? "Processing..." : file.status === "complete" ? "Reviewed" : "New"}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Content viewer */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedFile ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold truncate">{selectedFile.name}</h3>
              <div className="flex items-center gap-2 flex-shrink-0">
                {selectedFile.status === "new" && (
                  <button
                    onClick={() => handleProcess(selectedFile)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-light transition-colors"
                  >
                    Process Now
                  </button>
                )}
                {selectedFile.status === "complete" && (
                  <div className="flex rounded-lg bg-gray-100 dark:bg-dark-card p-0.5">
                    {(["parsed", "review", "summary"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => handleViewContent(selectedFile, t)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          viewType === t
                            ? "bg-accent text-white shadow-sm"
                            : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        }`}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface">
              {loadingContent ? (
                <div className="p-6 text-center text-gray-400">Loading...</div>
              ) : selectedFile?.status === "new" && !viewContent ? (
                <div className="p-6 flex flex-col items-center justify-center text-center gap-3 h-full">
                  <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Document not yet processed
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Click "Process Now" or enable the watcher in Settings
                  </p>
                </div>
              ) : selectedFile?.status === "processing" ? (
                <div className="p-6 flex flex-col items-center justify-center text-center gap-3 h-full">
                  <div className="w-12 h-12 rounded-full bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center animate-pulse">
                    <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Processing document...
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Review and summary will appear when complete
                  </p>
                </div>
              ) : viewContent ? (
                <div className="p-6">
                  {viewType === "parsed" ? (
                    <pre className="text-sm whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300">
                      {viewContent}
                    </pre>
                  ) : (
                    <Markdown content={viewContent} />
                  )}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-400">
                  Select a view type above
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Select a document to view
          </div>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: "bg-blue-400",
    processing: "bg-yellow-400 animate-pulse",
    complete: "bg-green-500",
    error: "bg-red-500",
  };
  return (
    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[status] || colors.new}`} />
  );
}

async function getHome(): Promise<string> {
  try {
    const { homeDir } = await import("@tauri-apps/api/path");
    return await homeDir();
  } catch {
    return "/Users/aialchemy";
  }
}
