import { useState, useEffect } from "react";
import { listDirectory } from "../lib/tauri";
import type { FileEntry } from "../types";

export default function Matters() {
  const [matters, setMatters] = useState<FileEntry[]>([]);
  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [matterFiles, setMatterFiles] = useState<FileEntry[]>([]);

  useEffect(() => {
    listDirectory("matters").then((files) => {
      setMatters(files.filter((f) => f.is_dir));
    }).catch(() => {});
  }, []);

  const handleSelect = async (matter: FileEntry) => {
    setSelected(matter);
    try {
      const files = await listDirectory(`matters/${matter.name}`);
      setMatterFiles(files);
    } catch {
      setMatterFiles([]);
    }
  };

  return (
    <div className="max-w-5xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Matters</h2>

      {matters.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No matters created yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Matters organize documents and deliverables by client or case
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            {matters.map((m) => (
              <button
                key={m.path}
                onClick={() => handleSelect(m)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selected?.path === m.path
                    ? "border-accent bg-accent/5"
                    : "hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="font-medium text-sm">{m.name}</span>
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <div>
              <h3 className="font-semibold text-sm text-gray-700 mb-3">
                {selected.name}
              </h3>
              {matterFiles.length === 0 ? (
                <p className="text-sm text-gray-400">Empty matter</p>
              ) : (
                <div className="space-y-1">
                  {matterFiles.map((f) => (
                    <div
                      key={f.path}
                      className="text-sm p-2 bg-gray-50 rounded flex items-center justify-between"
                    >
                      <span className="truncate">{f.name}</span>
                      <span className="text-xs text-gray-400">
                        {f.is_dir ? "folder" : `${(f.size / 1024).toFixed(1)} KB`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
