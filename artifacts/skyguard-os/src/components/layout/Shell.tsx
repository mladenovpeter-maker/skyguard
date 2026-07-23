import { Link, useLocation } from "wouter";
import { useGetIngestStatus, getGetIngestStatusQueryKey } from "@workspace/api-client-react";
import { Settings, History, Radar, ShieldCheck, Languages, Cpu, LogOut, RadioTower, Menu, X, Sun, Moon } from "lucide-react";
import { ReactNode, useState } from "react";
import { useClerk, useUser } from "@clerk/react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function ConnectionBadge() {
  const { t } = useLanguage();
  const { data: status } = useGetIngestStatus({
    query: { refetchInterval: 3000, queryKey: getGetIngestStatusQueryKey() },
  });
  const isConnected = status?.connected ?? false;
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-card/50 border shadow-sm">
      <div className="relative flex h-2.5 w-2.5">
        {isConnected ? (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
          </>
        ) : (
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
        )}
      </div>
      <span className={cn("text-xs font-mono font-medium tracking-wide uppercase", isConnected ? "text-primary" : "text-destructive")}>
        {isConnected ? t("badge.online") : t("badge.offline")}
      </span>
      {status && (
        <span className="text-xs font-mono text-muted-foreground hidden sm:inline ml-1 border-l border-border pl-2">
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
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-card/50 border shadow-sm text-xs font-mono font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      aria-label="Toggle language"
    >
      <Languages className="h-3.5 w-3.5" />
      {language === "en" ? "BG" : "EN"}
    </button>
  );
}

/* ── Pi Monitor ──────────────────────────────────────────────────────────── */

interface PiStatusData {
  cpuPercent: number;
  cpuTempC: number | null;
  memPercent: number;
  diskPercent: number;
  uptimeS: number;
  receivedAt: string;
}

function usePiStatus() {
  return useQuery<PiStatusData | null>({
    queryKey: ["pi-status"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/pi-status`, { credentials: "include" });
      if (res.status === 204) return null;
      return res.ok ? res.json() : null;
    },
    refetchInterval: 30_000,
    staleTime: 29_000,
  });
}

function useBleStatus() {
  return useQuery<{ totalScans: number; dronesDetected: number; adapter: string; receivedAt: string } | null>({
    queryKey: ["ble-status"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/ble-status`, { credentials: "include" });
      if (res.status === 204) return null;
      return res.ok ? res.json() : null;
    },
    refetchInterval: 30_000,
    staleTime: 29_000,
  });
}

function BleBadge() {
  const { data: ble } = useBleStatus();
  if (!ble) return null;
  const alive = Date.now() - new Date(ble.receivedAt).getTime() < 120_000;
  if (!alive) return null;
  return (
    <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded bg-card/50 border text-[10px] font-mono" title={`Adapter: ${ble.adapter} | Scans: ${ble.totalScans}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
      <span className="text-blue-400">BLE</span>
      {ble.dronesDetected > 0 && <span className="text-yellow-400">{ble.dronesDetected}</span>}
    </div>
  );
}

function MiniBar({ pct, warn = 70, danger = 90 }: { pct: number; warn?: number; danger?: number }) {
  const color = pct >= danger ? "#ef4444" : pct >= warn ? "#f59e0b" : "#22c55e";
  return (
    <div className="flex items-center gap-1">
      <div className="w-10 h-1.5 rounded-full bg-muted overflow-hidden">
        <div style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color, height: "100%", borderRadius: 9999, transition: "width 0.5s" }} />
      </div>
      <span style={{ color }} className="text-[9px] font-mono w-7 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

function PiMonitor() {
  const { data: pi } = usePiStatus();
  if (!pi) return null;
  const stale = Date.now() - new Date(pi.receivedAt).getTime() > 90_000;
  if (stale) return null;
  const upH = Math.floor(pi.uptimeS / 3600);
  const upM = Math.floor((pi.uptimeS % 3600) / 60);
  const tempColor = pi.cpuTempC == null ? "#888" : pi.cpuTempC >= 75 ? "#ef4444" : pi.cpuTempC >= 60 ? "#f59e0b" : "#22c55e";
  return (
    <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-card/50 border shadow-sm" title={`Pi uptime: ${upH}h ${upM}m`}>
      <Cpu className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <MiniBar pct={pi.cpuPercent} />
          {pi.cpuTempC != null && (
            <span className="text-[9px] font-mono" style={{ color: tempColor }}>{pi.cpuTempC.toFixed(0)}°C</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <MiniBar pct={pi.memPercent} warn={75} danger={90} />
          <span className="text-[9px] font-mono text-muted-foreground">{upH}h{upM}m</span>
        </div>
      </div>
    </div>
  );
}

/* ── Shell ───────────────────────────────────────────────────────────────── */

export function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useLanguage();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { theme, setTheme } = useTheme();

  const links = [
    { href: "/",          label: t("nav.radar"),    icon: Radar },
    { href: "/spectrum",  label: t("nav.spectrum"), icon: RadioTower },
    { href: "/history",   label: t("nav.history"),  icon: History },
    { href: "/settings",  label: t("nav.settings"), icon: Settings },
    { href: "/admin",     label: t("nav.admin"),    icon: Cpu },
  ];

  return (
    <div className="h-[100dvh] flex flex-col bg-background text-foreground overflow-hidden">
      {/* ── Top header ── */}
      <header className="h-14 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4 z-50 flex-shrink-0">
        {/* Left: logo + desktop nav */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="font-mono font-bold tracking-tight text-primary uppercase text-sm">SkyGuard OS</h1>
          </div>
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-secondary",
                  location === href ? "bg-secondary text-foreground" : "text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Right: badges + hamburger */}
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <PiMonitor />
          {/* User email + logout — desktop */}
          <div className="hidden md:flex items-center gap-2 pl-2 border-l border-border/50">
            {user && (
              <span className="text-xs font-mono text-muted-foreground hidden xl:inline">
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
          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {/* Hamburger — mobile */}
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-md hover:bg-secondary transition-colors"
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* ── Mobile slide-down menu ── */}
      {menuOpen && (
        <div className="md:hidden border-b border-border/50 bg-background/98 backdrop-blur z-40 flex-shrink-0">
          <nav className="flex flex-col p-2 gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors",
                  location === href ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
            {/* Logout in mobile menu */}
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              {t("nav.logout")}
            </button>
          </nav>
        </div>
      )}

      <main className="flex-1 flex flex-col relative overflow-y-auto">
        {children}
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden flex-shrink-0 border-t border-border/50 bg-background/95 backdrop-blur grid grid-cols-5 safe-area-bottom">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-mono uppercase tracking-wide transition-colors",
              location === href ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className={cn("h-5 w-5", location === href && "text-primary")} />
            <span className="text-[9px]">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
