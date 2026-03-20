import type { FileEntry } from "../types";

interface DeliverableCardProps {
  file: FileEntry;
  onView: (file: FileEntry) => void;
}

export default function DeliverableCard({ file, onView }: DeliverableCardProps) {
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
      onClick={() => onView(file)}
      className="border dark:border-dark-border rounded-lg p-4 hover:border-accent/50 hover:shadow-sm cursor-pointer transition-all bg-white dark:bg-dark-surface"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{file.name}</h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-dark-card rounded">{typeLabel}</span>
            <span>{sizeLabel}</span>
            {file.modified && (
              <span>{new Date(file.modified * 1000).toLocaleDateString()}</span>
            )}
          </div>
        </div>
        <svg className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}
