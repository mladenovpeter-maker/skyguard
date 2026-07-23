import { createContext, useContext, useEffect, useState, ReactNode } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export type Role = "admin" | "operator";

export interface AuthUser {
  username: string;
  role: Role;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoaded: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setUser(data ?? null);
        setIsLoaded(true);
      })
      .catch(() => setIsLoaded(true));
  }, []);

  async function login(username: string, password: string) {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error ?? "Login failed");
    }
    const data = await r.json();
    setUser(data);
  }

  async function logout() {
    await fetch(`${BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoaded, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
