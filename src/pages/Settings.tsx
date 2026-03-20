import { useState, useEffect } from "react";
import {
  checkOllama,
  startPaperclip,
  stopPaperclip,
  getDirectorConfig,
  saveDirectorConfig,
  startWatching,
  stopWatching,
  getWatcherStatus,
} from "../lib/tauri";
import { useTheme } from "../lib/theme";
import { useAuth } from "../lib/auth";
import { getSettings, saveSettings, getModel } from "../lib/settings";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import type { ServiceStatuses, DirectorConfig, DirectorEvent } from "../types";

const API = "http://localhost:3101/api";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

interface SettingsProps {
  services: ServiceStatuses;
}

export default function Settings({ services }: SettingsProps) {
  const { preference, setPreference } = useTheme();
  const { user } = useAuth();
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState(getSettings().model);
  const [saved, setSaved] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  // Director state
  const [directorConfig, setDirectorConfig] = useState<DirectorConfig | null>(null);
  const [watcherActive, setWatcherActive] = useState(false);
  const [directorStatus, setDirectorStatus] = useState<string | null>(null);
  const [watcherStarting, setWatcherStarting] = useState(false);

  useEffect(() => {
    checkOllama().then((status) => {
      if (status.running) setModels(status.models);
    });
    getDirectorConfig().then(setDirectorConfig);
    getWatcherStatus().then(setWatcherActive);

    // Listen for director events
    const unlisten = Promise.all([
      listen<DirectorEvent>("director:status", (e) => {
        setDirectorStatus(e.payload.message);
        if (e.payload.event_type === "watching") setWatcherActive(true);
      }),
      listen<DirectorEvent>("director:processing", (e) => {
        setDirectorStatus(`Processing: ${e.payload.filename}`);
      }),
      listen<DirectorEvent>("director:complete", (e) => {
        setDirectorStatus(`Completed: ${e.payload.filename} (${e.payload.document_type})`);
      }),
      listen<DirectorEvent>("director:error", (e) => {
        setDirectorStatus(`Error: ${e.payload.message}`);
      }),
    ]);

    return () => {
      unlisten.then((fns) => fns.forEach((fn) => fn()));
    };
  }, []);

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    saveSettings({ model });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleStartPaperclip = async () => {
    setStarting(true);
    try {
      await startPaperclip();
    } catch {}
    setStarting(false);
  };

  const handleStopPaperclip = async () => {
    setStopping(true);
    try {
      await stopPaperclip();
    } catch {}
    setStopping(false);
  };

  const handleSelectInbox = async () => {
    const selected = await open({ directory: true, title: "Select Inbox Folder" });
    if (selected && typeof selected === "string") {
      const newConfig: DirectorConfig = {
        inbox_path: selected,
        auto_process: directorConfig?.auto_process ?? true,
        model: directorConfig?.model ?? getModel(),
      };
      await saveDirectorConfig(newConfig);
      setDirectorConfig(newConfig);
      saveSettings({ watchDir: selected });
    }
  };

  const handleToggleWatcher = async () => {
    if (watcherActive) {
      try {
        await stopWatching();
        setWatcherActive(false);
        setDirectorStatus(null);
      } catch (e) {
        setDirectorStatus(`Failed to stop: ${e}`);
      }
    } else {
      if (!directorConfig?.inbox_path) {
        setDirectorStatus("Select an inbox folder first");
        return;
      }
      setWatcherStarting(true);
      try {
        await startWatching();
        setWatcherActive(true);
      } catch (e) {
        setDirectorStatus(`Failed to start: ${e}`);
      }
      setWatcherStarting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="space-y-6">
        {/* Director / Inbox Watcher */}
        <section className="border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface overflow-hidden">
          <div className="px-5 py-3 border-b dark:border-dark-border bg-gray-50 dark:bg-dark-card">
            <h3 className="font-semibold text-sm">Director Agent</h3>
          </div>
          <div className="p-5 space-y-4">
            {/* Inbox folder */}
            <div>
              <p className="text-sm font-medium">Watch Folder</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-2">
                New documents in this folder are automatically reviewed
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-gray-100 dark:bg-dark-card px-3 py-2 rounded-lg font-mono truncate">
                  {directorConfig?.inbox_path || "No folder selected"}
                </code>
                <button
                  onClick={handleSelectInbox}
                  className="px-3 py-2 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-light transition-colors whitespace-nowrap"
                >
                  Browse
                </button>
              </div>
            </div>

            {/* Watcher toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    watcherActive ? "bg-green-500 animate-pulse" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                />
                <div>
                  <p className="text-sm font-medium">
                    {watcherActive ? "Watching" : "Inactive"}
                  </p>
                  {directorStatus && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {directorStatus}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleToggleWatcher}
                disabled={watcherStarting}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                  watcherActive
                    ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
                    : "bg-accent text-white hover:bg-accent-light"
                }`}
              >
                {watcherStarting
                  ? "Starting..."
                  : watcherActive
                  ? "Stop"
                  : "Start Watching"}
              </button>
            </div>

            {/* Auto-process toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-process</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Automatically review and summarize new documents
                </p>
              </div>
              <button
                onClick={async () => {
                  if (!directorConfig) return;
                  const updated = {
                    ...directorConfig,
                    auto_process: !directorConfig.auto_process,
                  };
                  await saveDirectorConfig(updated);
                  setDirectorConfig(updated);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  directorConfig?.auto_process
                    ? "bg-accent"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                    directorConfig?.auto_process ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Services */}
        <section className="border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface overflow-hidden">
          <div className="px-5 py-3 border-b dark:border-dark-border bg-gray-50 dark:bg-dark-card">
            <h3 className="font-semibold text-sm">Services</h3>
          </div>
          <div className="p-5 space-y-4">
            {/* Paperclip */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${services.paperclip.running ? "bg-green-500" : "bg-red-500"}`} />
                <div>
                  <p className="text-sm font-medium">Paperclip</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {services.paperclip.running ? "Connected" : services.paperclip.error || "Not running"}
                  </p>
                </div>
              </div>
              {services.paperclip.running ? (
                <button
                  onClick={handleStopPaperclip}
                  disabled={stopping}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 transition-colors"
                >
                  {stopping ? "Stopping..." : "Stop"}
                </button>
              ) : (
                <button
                  onClick={handleStartPaperclip}
                  disabled={starting}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-light disabled:opacity-50 transition-colors"
                >
                  {starting ? "Starting..." : "Start Paperclip"}
                </button>
              )}
            </div>

            {/* Ollama */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${services.ollama.running ? "bg-green-500" : "bg-red-500"}`} />
                <div>
                  <p className="text-sm font-medium">Ollama</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {services.ollama.running
                      ? `${services.ollama.models.length} model${services.ollama.models.length !== 1 ? "s" : ""} available`
                      : services.ollama.error || "Not running"}
                  </p>
                  {services.ollama.running && (
                    <p className="text-xs text-accent dark:text-blue-400 font-mono">Active: {getModel()}</p>
                  )}
                </div>
              </div>
            </div>

            {/* LiteParse */}
            <div className="flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full ${services.liteparse ? "bg-green-500" : "bg-red-500"}`} />
              <div>
                <p className="text-sm font-medium">LiteParse</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {services.liteparse ? "Installed" : "Not found"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface overflow-hidden">
          <div className="px-5 py-3 border-b dark:border-dark-border bg-gray-50 dark:bg-dark-card">
            <h3 className="font-semibold text-sm">Appearance</h3>
          </div>
          <div className="p-5">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-3">
                Choose light, dark, or follow your system setting
              </p>
              <div className="flex gap-2">
                {(["light", "dark", "auto"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setPreference(opt)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      preference === opt
                        ? "bg-accent text-white"
                        : "bg-gray-100 dark:bg-dark-card text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-border"
                    }`}
                  >
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Model selection */}
        <section className="border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface overflow-hidden">
          <div className="px-5 py-3 border-b dark:border-dark-border bg-gray-50 dark:bg-dark-card">
            <h3 className="font-semibold text-sm">LLM Model</h3>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <p className="text-sm font-medium">Active Model</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Used for document review, memo drafting, and chat
              </p>
            </div>

            {models.length === 0 ? (
              <div className="text-sm text-gray-400 bg-gray-50 dark:bg-dark-card rounded-lg p-3">
                No models detected. Make sure Ollama is running.
              </div>
            ) : (
              <div className="space-y-1.5">
                {models.map((model) => (
                  <button
                    key={model}
                    onClick={() => handleModelChange(model)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                      selectedModel === model
                        ? "bg-accent text-white"
                        : "bg-gray-50 dark:bg-dark-card hover:bg-gray-100 dark:hover:bg-dark-border text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <span className="font-mono">{model}</span>
                    {selectedModel === model && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}

            {saved && (
              <p className="text-xs text-green-600 dark:text-green-400">Model saved</p>
            )}
          </div>
        </section>

        {/* Users (admin only) */}
        {user?.role === "admin" && <UsersSection />}

        {/* Paths */}
        <section className="border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface overflow-hidden">
          <div className="px-5 py-3 border-b dark:border-dark-border bg-gray-50 dark:bg-dark-card">
            <h3 className="font-semibold text-sm">Paths</h3>
          </div>
          <div className="p-5 space-y-3">
            <PathRow label="Working Directory" path="~/paralegal" />
            <PathRow label="Inbox" path={directorConfig?.inbox_path || "~/paralegal/inbox"} />
            <PathRow label="Deliverables" path="~/paralegal/deliverables" />
            <PathRow label="Database" path="~/paralegal/data/paperclip.db" />
          </div>
        </section>
      </div>
    </div>
  );
}

function UsersSection() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("paralegal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    try {
      const res = await fetch(`${API}/auth/users`, { headers });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch {}
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed" }));
        setError(data.error);
      } else {
        setName(""); setEmail(""); setPassword(""); setRole("paralegal");
        setShowForm(false);
        loadUsers();
      }
    } catch {
      setError("Connection failed");
    }
    setSubmitting(false);
  }

  async function handleRoleChange(userId: string, newRole: string) {
    await fetch(`${API}/auth/users/${userId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ role: newRole }),
    });
    loadUsers();
  }

  async function handleDelete(userId: string, userName: string) {
    if (!window.confirm(`Remove user "${userName}"?`)) return;
    await fetch(`${API}/auth/users/${userId}`, { method: "DELETE", headers });
    loadUsers();
  }

  return (
    <section className="border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface overflow-hidden">
      <div className="px-5 py-3 border-b dark:border-dark-border bg-gray-50 dark:bg-dark-card flex items-center justify-between">
        <h3 className="font-semibold text-sm">Users</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-light transition-colors"
        >
          {showForm ? "Cancel" : "Add User"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="p-5 border-b dark:border-dark-border space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              required
              className="px-3 py-2 border dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-card dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="px-3 py-2 border dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-card dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 8)"
              required
              minLength={8}
              className="px-3 py-2 border dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-card dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="px-3 py-2 border dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-card dark:text-gray-100"
            >
              <option value="admin">Admin</option>
              <option value="paralegal">Paralegal</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light disabled:opacity-50 transition-colors"
          >
            {submitting ? "Creating..." : "Create User"}
          </button>
        </form>
      )}

      <div className="divide-y dark:divide-dark-border">
        {users.map((u) => (
          <div key={u.id} className="px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/10 dark:bg-accent/20 flex items-center justify-center text-xs font-bold text-accent dark:text-blue-400">
                {u.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {u.name}
                  {u.id === currentUser?.id && (
                    <span className="ml-1.5 text-[10px] text-gray-400">(you)</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={u.role}
                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                disabled={u.id === currentUser?.id}
                className="px-2 py-1 border dark:border-dark-border rounded text-xs bg-white dark:bg-dark-card dark:text-gray-100 disabled:opacity-50"
              >
                <option value="admin">Admin</option>
                <option value="paralegal">Paralegal</option>
                <option value="viewer">Viewer</option>
              </select>
              {u.id !== currentUser?.id && (
                <button
                  onClick={() => handleDelete(u.id, u.name)}
                  className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PathRow({ label, path }: { label: string; path: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <code className="text-xs bg-gray-100 dark:bg-dark-card px-2 py-1 rounded font-mono max-w-[300px] truncate">
        {path}
      </code>
    </div>
  );
}
