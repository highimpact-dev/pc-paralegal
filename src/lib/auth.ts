import { createContext, useContext } from "react";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "paralegal" | "viewer";
}

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  companyName: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  setup: (name: string, email: string, password: string, companyName: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  companyName: null,
  loading: true,
  login: async () => {},
  setup: async () => {},
  register: async () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const API = "http://localhost:3101/api";
const TOKEN_KEY = "pc-paralegal-token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiLogin(email: string, password: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Login failed" }));
    throw new Error(err.error || "Login failed");
  }
  return res.json();
}

export async function apiRegister(name: string, email: string, password: string, token?: string | null): Promise<{ id: string; name: string; email: string; role: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Registration failed" }));
    throw new Error(err.error || "Registration failed");
  }
  return res.json();
}

export async function apiGetMe(token: string): Promise<User> {
  const res = await fetch(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Session expired");
  return res.json();
}

export async function apiLogout(token: string): Promise<void> {
  await fetch(`${API}/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

export async function apiSetup(
  name: string,
  email: string,
  password: string,
  companyName: string
): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API}/auth/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, companyName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Setup failed" }));
    throw new Error(err.error || "Setup failed");
  }
  return res.json();
}

export async function apiSetupStatus(): Promise<{ needsSetup: boolean }> {
  const res = await fetch(`${API}/auth/setup-status`);
  if (!res.ok) return { needsSetup: true };
  return res.json();
}

export async function apiGetCompanyName(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${API}/companies`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.companies?.[0]?.name || null;
  } catch {
    return null;
  }
}
