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
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
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
import {
  AuthContext,
  type User,
  getStoredToken,
  setStoredToken,
  apiLogin,
  apiSetup,
  apiRegister,
  apiGetMe,
  apiGetCompanyName,
  apiLogout,
  apiSetupStatus,
} from "./lib/auth";

export default function App() {
  const [services, setServices] = useState<ServiceStatuses>({
    paperclip: { running: false, url: "" },
    ollama: { running: false, models: [] },
    liteparse: false,
  });

  const [preference, setPreferenceRaw] = useState<ThemePreference>(getStoredPreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(resolveTheme(getStoredPreference()));

  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

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

  // Check auth on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const status = await apiSetupStatus();
        if (status.needsSetup) {
          setNeedsSetup(true);
          setAuthLoading(false);
          return;
        }
        const stored = getStoredToken();
        if (stored) {
          const me = await apiGetMe(stored);
          setUser(me);
          setToken(stored);
          const name = await apiGetCompanyName(stored);
          setCompanyName(name);
        }
      } catch {
        setStoredToken(null);
      }
      setAuthLoading(false);
    }
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const result = await apiLogin(email, password);
    setStoredToken(result.token);
    setToken(result.token);
    setUser(result.user);
    setNeedsSetup(false);
    const name = await apiGetCompanyName(result.token);
    setCompanyName(name);
  };

  const setup = async (name: string, email: string, password: string, coName: string) => {
    try {
      const result = await apiSetup(name, email, password, coName);
      setStoredToken(result.token);
      setToken(result.token);
      setUser(result.user);
      setCompanyName(coName);
      setNeedsSetup(false);
    } catch (err) {
      // If setup already completed, redirect to login
      if (err instanceof Error && err.message.includes("already completed")) {
        setNeedsSetup(false);
        return;
      }
      throw err;
    }
  };

  const register = async (name: string, email: string, password: string) => {
    await apiRegister(name, email, password, token);
    await login(email, password);
  };

  const logout = async () => {
    if (token) await apiLogout(token);
    setStoredToken(null);
    setToken(null);
    setUser(null);
  };

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

  const themeValue = { preference, resolved, setPreference };
  const authValue = { user, token, companyName, loading: authLoading, login, setup, register, logout };

  if (authLoading) {
    return (
      <ThemeContext.Provider value={themeValue}>
        <div className="flex h-screen items-center justify-center bg-white dark:bg-dark-bg">
          <p className="text-gray-400">Loading...</p>
        </div>
      </ThemeContext.Provider>
    );
  }

  if (needsSetup) {
    return (
      <ThemeContext.Provider value={themeValue}>
        <AuthContext.Provider value={authValue}>
          <Onboarding />
        </AuthContext.Provider>
      </ThemeContext.Provider>
    );
  }

  if (!user) {
    return (
      <ThemeContext.Provider value={themeValue}>
        <AuthContext.Provider value={authValue}>
          <Login />
        </AuthContext.Provider>
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={themeValue}>
      <AuthContext.Provider value={authValue}>
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
      </AuthContext.Provider>
    </ThemeContext.Provider>
  );
}
