import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login, user } = useAuth();
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already logged in → go to radar
  if (user) { navigate("/"); return null; }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch {
      setError("Грешно потребителско име или парола");
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center px-4"
      style={{ background: "#020814", fontFamily: "'Space Mono','Courier New',monospace" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4 mb-10">
          <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
            <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" stroke="#00ff88" strokeWidth="1.2" fill="none" opacity="0.6"/>
            <circle cx="16" cy="16" r="7" stroke="#00ff88" strokeWidth="1" fill="none" opacity="0.4"/>
            <line x1="16" y1="9" x2="16" y2="23" stroke="#00ff88" strokeWidth="0.6" opacity="0.4"/>
            <line x1="9" y1="16" x2="23" y2="16" stroke="#00ff88" strokeWidth="0.6" opacity="0.4"/>
            <circle cx="16" cy="16" r="2.2" fill="#00ff88"/>
            <line x1="16" y1="16" x2="11" y2="11" stroke="#00ff88" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="16" y1="16" x2="21" y2="11" stroke="#00ff88" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="16" y1="16" x2="11" y2="21" stroke="#00ff88" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="16" y1="16" x2="21" y2="21" stroke="#00ff88" strokeWidth="1.2" strokeLinecap="round"/>
            <circle cx="10.5" cy="10.5" r="2.2" stroke="#00ff88" strokeWidth="0.8" fill="none" opacity="0.7"/>
            <circle cx="21.5" cy="10.5" r="2.2" stroke="#00ff88" strokeWidth="0.8" fill="none" opacity="0.7"/>
            <circle cx="10.5" cy="21.5" r="2.2" stroke="#00ff88" strokeWidth="0.8" fill="none" opacity="0.7"/>
            <circle cx="21.5" cy="21.5" r="2.2" stroke="#00ff88" strokeWidth="0.8" fill="none" opacity="0.7"/>
            <circle cx="21.5" cy="10.5" r="1" fill="#ff5050" opacity="0.9"/>
          </svg>
          <div className="text-center">
            <div className="text-lg font-bold tracking-[0.25em]" style={{ color: "#00ff88" }}>DRONEXIT</div>
            <div className="text-xs tracking-widest mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>ОГРАНИЧЕН ДОСТЪП</div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            placeholder="Потребител"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
            required
            className="w-full px-4 py-3 text-sm outline-none transition-colors"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(0,255,136,0.2)",
              color: "rgba(255,255,255,0.85)",
              fontFamily: "inherit",
            }}
            onFocus={e => (e.target.style.borderColor = "rgba(0,255,136,0.6)")}
            onBlur={e => (e.target.style.borderColor = "rgba(0,255,136,0.2)")}
          />
          <input
            type="password"
            placeholder="Парола"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="w-full px-4 py-3 text-sm outline-none transition-colors"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(0,255,136,0.2)",
              color: "rgba(255,255,255,0.85)",
              fontFamily: "inherit",
            }}
            onFocus={e => (e.target.style.borderColor = "rgba(0,255,136,0.6)")}
            onBlur={e => (e.target.style.borderColor = "rgba(0,255,136,0.2)")}
          />

          {error && (
            <p className="text-xs text-center py-2" style={{ color: "#ff5050" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-sm font-bold tracking-widest transition-all mt-2"
            style={{
              background: loading ? "rgba(0,255,136,0.3)" : "#00ff88",
              color: "#020814",
              fontFamily: "inherit",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "ВЛИЗАНЕ..." : "ВХОД →"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => navigate("/")}
            className="text-xs transition-colors"
            style={{ color: "rgba(255,255,255,0.2)", fontFamily: "inherit" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(0,255,136,0.5)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.2)")}
          >
            ← ОБРАТНО
          </button>
        </div>
      </div>
    </div>
  );
}
