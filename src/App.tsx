import { Routes, Route } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import StatusBar from "./components/StatusBar";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Deliverables from "./pages/Deliverables";
import Chat from "./pages/Chat";
import Matters from "./pages/Matters";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import { checkServices, type ServiceStatuses } from "./lib/tauri";
import {
  ThemeContext,
  getStoredPreference,
  resolveTheme,
  applyTheme,
  savePreference,
  type ThemePreference,
  type ResolvedTheme,
} from "./lib/theme";

export default function App() {
  const [services, setServices] = useState<ServiceStatuses>({
    paperclip: { running: false, url: "" },
    ollama: { running: false, models: [] },
    liteparse: false,
  });

  const [preference, setPreferenceRaw] = useState<ThemePreference>(getStoredPreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(resolveTheme(getStoredPreference()));

  // Whenever resolved changes, apply to DOM immediately
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  // When preference is "auto", listen for OS changes
  useEffect(() => {
    if (preference !== "auto") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const next = mql.matches ? "dark" : "light";
      setResolved(next);
      applyTheme(next); // apply immediately, don't wait for re-render
    };
    handler();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [preference]);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceRaw(pref);
    savePreference(pref);
    const next = resolveTheme(pref);
    setResolved(next);
    applyTheme(next); // apply immediately, don't wait for re-render
  }, []);

  // Poll services
  useEffect(() => {
    const poll = async () => {
      const s = await checkServices();
      setServices(s);
    };
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, []);

  // Apply theme on mount
  useEffect(() => {
    applyTheme(resolved);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      <div className="flex h-screen bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 transition-colors">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <main className="flex-1 overflow-auto p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/deliverables" element={<Deliverables />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/matters" element={<Matters />} />
              <Route path="/settings" element={<Settings services={services} />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </main>
          <StatusBar services={services} />
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
