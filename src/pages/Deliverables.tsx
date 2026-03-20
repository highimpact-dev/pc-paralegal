import { useState, useEffect } from "react";
import { listDirectory, readFileText } from "../lib/tauri";
import DeliverableCard from "../components/DeliverableCard";
import Markdown from "../components/Markdown";
import type { FileEntry } from "../types";

export default function Deliverables() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [content, setContent] = useState<string>("");

  useEffect(() => {
    listDirectory("deliverables").then(setFiles).catch(() => {});
  }, []);

  const handleView = async (file: FileEntry) => {
    setSelected(file);
    try {
      const text = await readFileText(file.path);
      setContent(text);
    } catch {
      setContent("Failed to read file");
    }
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
                <DeliverableCard key={f.path} file={f} onView={handleView} />
              ))}
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
