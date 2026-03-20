import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { listDirectory } from "../lib/tauri";
import type { FileEntry, ServiceStatuses } from "../types";

interface DashboardProps {
  services: ServiceStatuses;
}

export default function Dashboard({ services }: DashboardProps) {
  const [inbox, setInbox] = useState<FileEntry[]>([]);
  const [deliverables, setDeliverables] = useState<FileEntry[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    listDirectory("inbox").then(setInbox).catch(() => {});
    listDirectory("deliverables").then(setDeliverables).catch(() => {});
  }, []);

  return (
    <div className="max-w-5xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

      {/* Service status cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <ServiceCard
          name="Paperclip"
          active={services.paperclip.running}
          detail={services.paperclip.running ? "Connected" : services.paperclip.error || "Not running"}
        />
        <ServiceCard
          name="Ollama"
          active={services.ollama.running}
          detail={
            services.ollama.running
              ? `${services.ollama.models.length} model${services.ollama.models.length !== 1 ? "s" : ""} available`
              : services.ollama.error || "Not running"
          }
        />
        <ServiceCard
          name="LiteParse"
          active={services.liteparse}
          detail={services.liteparse ? "Installed" : "Not found"}
        />
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700">Recent Uploads</h3>
            <button
              onClick={() => navigate("/upload")}
              className="text-xs text-accent hover:underline"
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
                  className="text-sm p-2 bg-gray-50 rounded flex items-center justify-between"
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
            <h3 className="font-semibold text-gray-700">Recent Deliverables</h3>
            <button
              onClick={() => navigate("/deliverables")}
              className="text-xs text-accent hover:underline"
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
                  className="text-sm p-2 bg-gray-50 rounded flex items-center justify-between"
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

function ServiceCard({
  name,
  active,
  detail,
}: {
  name: string;
  active: boolean;
  detail: string;
}) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`w-2 h-2 rounded-full ${active ? "bg-green-500" : "bg-red-500"}`}
        />
        <span className="font-medium text-sm">{name}</span>
      </div>
      <p className="text-xs text-gray-500">{detail}</p>
    </div>
  );
}
