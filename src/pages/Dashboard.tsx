import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { listDirectory, deleteFile, archiveFile, clearChatHistory } from "../lib/tauri";
import type { FileEntry } from "../types";

export default function Dashboard() {
  const [inbox, setInbox] = useState<FileEntry[]>([]);
  const [deliverables, setDeliverables] = useState<FileEntry[]>([]);
  const navigate = useNavigate();

  const loadFiles = () => {
    listDirectory("inbox").then(setInbox).catch(() => {});
    listDirectory("deliverables").then(setDeliverables).catch(() => {});
  };

  useEffect(() => { loadFiles(); }, []);

  const handleArchive = async (file: FileEntry) => {
    await archiveFile(file.path);
    clearChatHistory(file.path);
    loadFiles();
  };

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const handleDelete = async (file: FileEntry) => {
    if (pendingDelete !== file.path) {
      // First click: arm the delete (show red confirm state)
      setPendingDelete(file.path);
      setTimeout(() => setPendingDelete(null), 3000); // auto-cancel after 3s
      return;
    }
    // Second click: actually delete
    setPendingDelete(null);
    try {
      await deleteFile(file.path);
      clearChatHistory(file.path);
      loadFiles();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  };

  return (
    <div className="max-w-5xl">
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">Recent Uploads</h3>
            <button
              onClick={() => navigate("/upload")}
              className="text-xs text-accent dark:text-blue-400 hover:underline"
            >
              Upload new
            </button>
          </div>
          {inbox.length === 0 ? (
            <p className="text-sm text-gray-400">No documents uploaded yet</p>
          ) : (
            <div className="space-y-2">
              {inbox.slice(0, 5).map((f) => (
                <FileRow key={f.path} file={f} onArchive={handleArchive} onDelete={handleDelete} pendingDelete={pendingDelete} />
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">Recent Deliverables</h3>
            <button
              onClick={() => navigate("/deliverables")}
              className="text-xs text-accent dark:text-blue-400 hover:underline"
            >
              View all
            </button>
          </div>
          {deliverables.length === 0 ? (
            <p className="text-sm text-gray-400">No deliverables yet</p>
          ) : (
            <div className="space-y-2">
              {deliverables.slice(0, 5).map((f) => (
                <FileRow key={f.path} file={f} onArchive={handleArchive} onDelete={handleDelete} pendingDelete={pendingDelete} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FileRow({
  file,
  onArchive,
  onDelete,
  pendingDelete,
}: {
  file: FileEntry;
  onArchive: (f: FileEntry) => void;
  onDelete: (f: FileEntry) => void;
  pendingDelete: string | null;
}) {
  const isArmed = pendingDelete === file.path;
  return (
    <div className="group text-sm p-2 bg-gray-50 dark:bg-dark-card rounded flex items-center justify-between">
      <span className="truncate">{file.name}</span>
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
        {isArmed ? (
          <button
            onClick={() => onDelete(file)}
            className="text-[10px] font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded animate-pulse"
          >
            Click to confirm
          </button>
        ) : (
          <>
            <span className="text-xs text-gray-400">
              {file.modified ? new Date(file.modified * 1000).toLocaleDateString() : ""}
            </span>
            <button
              onClick={() => onArchive(file)}
              title="Archive"
              className="p-1 rounded text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(file)}
              title="Delete"
              className="p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
