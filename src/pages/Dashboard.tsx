import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { listDirectory } from "../lib/tauri";
import type { FileEntry } from "../types";

export default function Dashboard() {
  const [inbox, setInbox] = useState<FileEntry[]>([]);
  const [deliverables, setDeliverables] = useState<FileEntry[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    listDirectory("inbox").then(setInbox).catch(() => {});
    listDirectory("deliverables").then(setDeliverables).catch(() => {});
  }, []);

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
                <div
                  key={f.path}
                  className="text-sm p-2 bg-gray-50 dark:bg-dark-card rounded flex items-center justify-between"
                >
                  <span className="truncate">{f.name}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                    {f.modified
                      ? new Date(f.modified * 1000).toLocaleDateString()
                      : ""}
                  </span>
                </div>
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
                <div
                  key={f.path}
                  className="text-sm p-2 bg-gray-50 dark:bg-dark-card rounded flex items-center justify-between"
                >
                  <span className="truncate">{f.name}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                    {f.modified
                      ? new Date(f.modified * 1000).toLocaleDateString()
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
