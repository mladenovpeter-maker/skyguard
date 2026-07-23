import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError("Грешно потребителско име или парола");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <ShieldCheck className="h-12 w-12 text-primary" />
          <h1 className="font-mono font-bold tracking-tight text-primary uppercase text-lg">
            SkyGuard OS
          </h1>
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wide">
            Ограничен достъп
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="Потребител"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="font-mono"
              required
            />
            <Input
              type="password"
              placeholder="Парола"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="font-mono"
              required
            />
          </div>

          {error && (
            <p className="text-xs text-destructive font-mono text-center">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full font-mono uppercase tracking-wide text-xs"
          >
            {loading ? "Влизане..." : "Вход"}
          </Button>
        </form>
      </div>
    </div>
  );
}
