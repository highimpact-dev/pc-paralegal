import { useState, useEffect } from "react";
import { listDirectory, readFileText, deleteFile, archiveFile, restoreFile, clearChatHistory } from "../lib/tauri";
import DeliverableCard from "../components/DeliverableCard";
import Markdown from "../components/Markdown";
import type { FileEntry } from "../types";

export default function Deliverables() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [archivedDeliverables, setArchivedDeliverables] = useState<FileEntry[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [content, setContent] = useState<string>("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const loadFiles = () => {
    listDirectory("deliverables").then(setFiles).catch(() => {});
    listDirectory("archive").then((all) => {
      // Only show deliverable files in this archive view
      setArchivedDeliverables(all.filter((f) => f.name.startsWith("review-") || f.name.startsWith("memo-") || f.name.startsWith("summary-")));
    }).catch(() => {});
  };

  useEffect(() => { loadFiles(); }, []);

  const handleView = async (file: FileEntry) => {
    setSelected(file);
    try {
      const text = await readFileText(file.path);
      setContent(text);
    } catch {
      setContent("Failed to read file");
    }
  };

  const handleArchive = async (file: FileEntry) => {
    await archiveFile(file.path);
    clearChatHistory(file.path);
    if (selected?.path === file.path) { setSelected(null); setContent(""); }
    loadFiles();
  };

  const handleDelete = async (file: FileEntry) => {
    if (pendingDelete !== file.path) {
      setPendingDelete(file.path);
      setTimeout(() => setPendingDelete(null), 3000);
      return;
    }
    setPendingDelete(null);
    try { await deleteFile(file.path); } catch (e) { console.error("Delete failed:", e); return; }
    clearChatHistory(file.path);
    if (selected?.path === file.path) { setSelected(null); setContent(""); }
    loadFiles();
  };

  const handleRestore = async (file: FileEntry) => {
    await restoreFile(file.path, "deliverables");
    loadFiles();
  };

  return (
    <div className="max-w-5xl">
      <h2 className="text-2xl font-bold mb-6">Deliverables</h2>

      <div className="grid grid-cols-2 gap-6">
        <div>
          {files.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <p>No deliverables yet</p>
              <p className="text-sm mt-1">Upload and process a document to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((f) => (
                <DeliverableCard
                  key={f.path}
                  file={f}
                  onView={handleView}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  isSelected={selected?.path === f.path}
                  pendingDelete={pendingDelete}
                />
              ))}
            </div>
          )}

          {/* Archived deliverables */}
          {archivedDeliverables.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <svg className={`w-3 h-3 transition-transform ${showArchived ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Archived ({archivedDeliverables.length})
              </button>
              {showArchived && (
                <div className="mt-3 space-y-2">
                  {archivedDeliverables.map((f) => (
                    <div key={f.path} className="group text-sm p-2 bg-gray-50/50 dark:bg-dark-card/50 rounded flex items-center justify-between border border-dashed border-gray-200 dark:border-dark-border">
                      <div className="flex items-center gap-2 min-w-0 cursor-pointer" onClick={() => handleView(f)}>
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                        <span className="truncate text-gray-500 dark:text-gray-400">{f.name}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        {pendingDelete === f.path ? (
                          <button onClick={() => handleDelete(f)} className="text-[10px] font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded animate-pulse">
                            Confirm
                          </button>
                        ) : (
                          <>
                            <button onClick={() => handleRestore(f)} title="Restore" className="p-1 rounded text-gray-400 hover:text-green-600 dark:hover:text-green-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            </button>
                            <button onClick={() => handleDelete(f)} title="Delete" className="p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          {selected ? (
            <div className="border dark:border-dark-border rounded-lg overflow-hidden sticky top-0 bg-white dark:bg-dark-surface">
              <div className="bg-gray-50 dark:bg-dark-card px-4 py-2 border-b dark:border-dark-border flex items-center justify-between">
                <span className="font-medium text-sm truncate">{selected.name}</span>
                <button
                  onClick={() => { setSelected(null); setContent(""); }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 max-h-[70vh] overflow-auto">
                <Markdown content={content} />
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-400 py-12">
              Select a deliverable to view
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
