import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

const BLUE = "#1A6BFF";

export default function LoginPage() {
  const { login, user } = useAuth();
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) { navigate("/"); return null; }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch {
      setError("Incorrect username or password");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#080808",
      fontFamily: "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      padding: "0 16px",
    }}>
      {/* Subtle radial glow behind card */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 700px 500px at 50% 40%, rgba(26,107,255,0.07) 0%, transparent 70%)",
      }} />

      <div style={{ width: "100%", maxWidth: 400, position: "relative" }}>

        {/* Logo + wordmark */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 48 }}>
          {/* Radar icon matching the landing page nav */}
          <svg width="42" height="42" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="15" stroke="#ffffff" strokeWidth="1" opacity="0.25" />
            <circle cx="16" cy="16" r="9"  stroke="#ffffff" strokeWidth="1" opacity="0.45" />
            <circle cx="16" cy="16" r="3.5" fill="#ffffff" opacity="0.95" />
            <line x1="16" y1="1" x2="16" y2="9" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
            <circle cx="21.5" cy="10.5" r="2" fill="#ff4040" />
          </svg>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "#fff" }}>
            DronExit
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.15em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>
            Dashboard Access
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 20,
          padding: "36px 32px",
        }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
                Username
              </label>
              <input
                placeholder="Enter username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                required
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  fontSize: 14,
                  fontFamily: "inherit",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  color: "#fff",
                  outline: "none",
                  transition: "border-color 0.15s",
                  boxSizing: "border-box",
                }}
                onFocus={e => (e.target.style.borderColor = "rgba(26,107,255,0.5)")}
                onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
                Password
              </label>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  fontSize: 14,
                  fontFamily: "inherit",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  color: "#fff",
                  outline: "none",
                  transition: "border-color 0.15s",
                  boxSizing: "border-box",
                }}
                onFocus={e => (e.target.style.borderColor = "rgba(26,107,255,0.5)")}
                onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
              />
            </div>

            {error && (
              <div style={{
                fontSize: 13,
                color: "#f87171",
                textAlign: "center",
                padding: "8px 12px",
                background: "rgba(248,113,113,0.08)",
                borderRadius: 8,
                border: "1px solid rgba(248,113,113,0.15)",
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 8,
                width: "100%",
                padding: "13px 0",
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "inherit",
                letterSpacing: "0.02em",
                background: loading ? "rgba(26,107,255,0.4)" : BLUE,
                color: "#fff",
                border: "none",
                borderRadius: 12,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.2s, opacity 0.2s",
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#2979ff"; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = BLUE; }}
            >
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </form>
        </div>

        {/* Back link */}
        <div style={{ marginTop: 24, textAlign: "center" }}>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "none",
              border: "none",
              fontSize: 13,
              color: "rgba(255,255,255,0.2)",
              fontFamily: "inherit",
              cursor: "pointer",
              transition: "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.2)")}
          >
            ← Back to dronexit.com
          </button>
        </div>

      </div>
    </div>
  );
}
