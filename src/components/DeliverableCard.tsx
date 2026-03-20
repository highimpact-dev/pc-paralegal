import type { FileEntry } from "../types";

interface DeliverableCardProps {
  file: FileEntry;
  onView: (file: FileEntry) => void;
  onArchive?: (file: FileEntry) => void;
  onDelete?: (file: FileEntry) => void;
  isSelected?: boolean;
  pendingDelete?: string | null;
}

export default function DeliverableCard({ file, onView, onArchive, onDelete, isSelected, pendingDelete }: DeliverableCardProps) {
  const isArmed = pendingDelete === file.path;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const typeLabel =
    ext === "md" ? "Markdown" : ext === "txt" ? "Text" : ext === "json" ? "JSON" : ext.toUpperCase();
  const sizeLabel = file.size < 1024
    ? `${file.size} B`
    : file.size < 1024 * 1024
      ? `${(file.size / 1024).toFixed(1)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div
      className={`group border dark:border-dark-border rounded-lg p-4 hover:border-accent/50 hover:shadow-sm transition-all bg-white dark:bg-dark-surface ${
        isSelected ? "ring-2 ring-accent/30" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onView(file)}>
          <h3 className="font-medium text-sm truncate">{file.name}</h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-dark-card rounded">{typeLabel}</span>
            <span>{sizeLabel}</span>
            {file.modified && (
              <span>{new Date(file.modified * 1000).toLocaleDateString()}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onArchive && (
            <button
              onClick={(e) => { e.stopPropagation(); onArchive(file); }}
              title="Archive"
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-dark-card text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </button>
          )}
          {onDelete && isArmed ? (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(file); }}
              className="text-[10px] font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded animate-pulse"
            >
              Confirm delete
            </button>
          ) : onDelete ? (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(file); }}
              title="Delete"
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-dark-card text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
