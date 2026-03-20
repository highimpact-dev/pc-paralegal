import { useState, useEffect } from "react";
import { checkOllama } from "../lib/tauri";
import { useTheme } from "../lib/theme";
import { getSettings, saveSettings } from "../lib/settings";

export default function Settings() {
  const { preference, setPreference } = useTheme();
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState(getSettings().model);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    checkOllama().then((status) => {
      if (status.running) setModels(status.models);
    });
  }, []);

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    saveSettings({ model });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="space-y-6">
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

        {/* Paths */}
        <section className="border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface overflow-hidden">
          <div className="px-5 py-3 border-b dark:border-dark-border bg-gray-50 dark:bg-dark-card">
            <h3 className="font-semibold text-sm">Paths</h3>
          </div>
          <div className="p-5 space-y-3">
            <PathRow label="Working Directory" path="~/paralegal" />
            <PathRow label="Inbox" path="~/paralegal/inbox" />
            <PathRow label="Deliverables" path="~/paralegal/deliverables" />
            <PathRow label="Templates" path="~/paralegal/templates" />
          </div>
        </section>

        {/* Services */}
        <section className="border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface overflow-hidden">
          <div className="px-5 py-3 border-b dark:border-dark-border bg-gray-50 dark:bg-dark-card">
            <h3 className="font-semibold text-sm">Services</h3>
          </div>
          <div className="p-5 space-y-3">
            <PathRow label="Paperclip Server" path="http://localhost:3101" />
            <PathRow label="Ollama API" path="http://localhost:11434" />
          </div>
        </section>
      </div>
    </div>
  );
}

function PathRow({ label, path }: { label: string; path: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <code className="text-xs bg-gray-100 dark:bg-dark-card px-2 py-1 rounded font-mono">
        {path}
      </code>
    </div>
  );
}
