import { Link, useLocation } from "wouter";
import { useGetIngestStatus, getGetIngestStatusQueryKey } from "@workspace/api-client-react";
import { Activity, Settings, History, Radar, AlertTriangle, ShieldCheck, Languages, Cpu, LogOut } from "lucide-react";
import { ReactNode } from "react";
import { useClerk, useUser } from "@clerk/react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function ConnectionBadge() {
  const { t } = useLanguage();
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
        {isConnected ? t("badge.online") : t("badge.offline")}
      </span>
      {status && (
        <span className="text-xs font-mono text-muted-foreground ml-2 border-l border-border pl-2">
          {t("badge.det")}: {status.detectionsToday}
        </span>
      )}
    </div>
  );
}

function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();
  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-card/50 border shadow-sm text-xs font-mono font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      aria-label="Toggle language"
    >
      <Languages className="h-3.5 w-3.5" />
      {language === "en" ? "BG" : "EN"}
    </button>
  );
}

function UserMenu() {
  const { t } = useLanguage();
  const { signOut } = useClerk();
  const { user } = useUser();

  return (
    <div className="flex items-center gap-2 pl-3 border-l border-border/50">
      {user && (
        <span className="text-xs font-mono text-muted-foreground hidden lg:inline">
          {user.primaryEmailAddress?.emailAddress}
        </span>
      )}
      <button
        type="button"
        onClick={() => signOut({ redirectUrl: basePath || "/" })}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono font-medium uppercase tracking-wide text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        aria-label={t("nav.logout")}
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { t } = useLanguage();

  const links = [
    { href: "/", label: t("nav.radar"), icon: Radar },
    { href: "/history", label: t("nav.history"), icon: History },
    { href: "/settings", label: t("nav.settings"), icon: Settings },
    { href: "/admin", label: t("nav.admin"), icon: Cpu },
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
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <ConnectionBadge />
          <UserMenu />
        </div>
      </header>
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {children}
      </main>
    </div>
  );
}
