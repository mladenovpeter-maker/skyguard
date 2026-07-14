import { Link, useLocation } from "wouter";
import { useGetIngestStatus, getGetIngestStatusQueryKey } from "@workspace/api-client-react";
import { Activity, Settings, History, Radar, AlertTriangle, ShieldCheck } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

function ConnectionBadge() {
  const { data: status } = useGetIngestStatus({
    query: { refetchInterval: 3000, queryKey: getGetIngestStatusQueryKey() },
  });

  const isConnected = status?.connected ?? false;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-card/50 border shadow-sm">
      <div className="relative flex h-2.5 w-2.5">
        {isConnected ? (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
          </>
        ) : (
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive"></span>
        )}
      </div>
      <span className={cn("text-xs font-mono font-medium tracking-wide uppercase", isConnected ? "text-primary" : "text-destructive")}>
        {isConnected ? "System Online" : "Hardware Offline"}
      </span>
      {status && (
        <span className="text-xs font-mono text-muted-foreground ml-2 border-l border-border pl-2">
          DET: {status.detectionsToday}
        </span>
      )}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Radar", icon: Radar },
    { href: "/history", label: "History", icon: History },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground dark">
      <header className="h-14 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="font-mono font-bold tracking-tight text-primary uppercase text-sm">
              SkyGuard OS
            </h1>
          </div>
          <nav className="flex items-center gap-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = location === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-secondary",
                    isActive ? "bg-secondary text-foreground" : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <ConnectionBadge />
        </div>
      </header>
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {children}
      </main>
    </div>
  );
}
