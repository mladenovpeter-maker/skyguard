import { useEffect, useRef, useState, useCallback } from "react";
import { useGetHomeConfig, useListActiveDroneTracks, getListActiveDroneTracksQueryKey, useListFlightHistory } from "@workspace/api-client-react";
import { RadarMap, type RfAlertMapEntry } from "@/components/radar/RadarMap";
import { AudioAlarm } from "@/components/radar/AudioAlarm";
import { useLanguage } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { bg, enUS } from "date-fns/locale";
import {
  AlertTriangle, Loader2, Zap, Activity, Crosshair, Navigation,
  Radio, MapPin, Clock, ChevronRight, Bluetooth, Wifi, Signal
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { DroneTrack } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SpectrumBin { hz: number; dbm: number; }
interface SpectrumMessage { type: "spectrum"; data: SpectrumBin[]; ts: string; }
interface RfAlert {
  id: number; bandId: string; bandLabel: string; peakDbm: number;
  peakHz: number; threat: string; timestamp: string;
  possibleDrones?: string | null; aboveBaselineDb?: number | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WS_URL = (import.meta.env.VITE_HACKRF_WS_URL as string) ||
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/hackrf-ws`;

const DB_MIN = -95;
const DB_MAX = -35;

const DRONE_BANDS = [
  { id: "rc_433",   label: "RC 433",      hz_low: 430e6,  hz_high: 440e6,  color: "#f59e0b", threat: "medium" },
  { id: "rc_868",   label: "RC 868",      hz_low: 863e6,  hz_high: 870e6,  color: "#f59e0b", threat: "medium" },
  { id: "rc_915",   label: "RC 915",      hz_low: 902e6,  hz_high: 928e6,  color: "#f59e0b", threat: "medium" },
  { id: "dji_2400", label: "DJI 2.4G",    hz_low: 2400e6, hz_high: 2484e6, color: "#ef4444", threat: "high"   },
  { id: "dji_5150", label: "DJI O3 5.1G", hz_low: 5150e6, hz_high: 5250e6, color: "#ef4444", threat: "high"   },
  { id: "dji_5800", label: "DJI O3 5.8G", hz_low: 5725e6, hz_high: 5850e6, color: "#ef4444", threat: "high"   },
];

// ---------------------------------------------------------------------------
// WebSocket hook
// ---------------------------------------------------------------------------

function useSpectrumWs() {
  const [bins, setBins]           = useState<SpectrumBin[]>([]);
  const [sweepCount, setSweep]    = useState(0);
  const [peakDbm, setPeak]        = useState<number | null>(null);
  const [wsStatus, setStatus]     = useState<"connecting" | "connected" | "error">("connecting");
  const [lastSweepTs, setLastTs]  = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen    = () => setStatus("connected");
    ws.onerror   = () => setStatus("error");
    ws.onclose   = () => { setStatus("error"); setTimeout(connect, 3000); };
    ws.onmessage = (e) => {
      try {
        const msg: SpectrumMessage = JSON.parse(e.data);
        if (msg.type === "spectrum") {
          setBins(msg.data);
          setSweep(c => c + 1);
          setLastTs(Date.now());
          const peak = msg.data.reduce((a, b) => b.dbm > a.dbm ? b : a, msg.data[0]);
          if (peak) setPeak(Math.round(peak.dbm * 10) / 10);
        }
      } catch {}
    };
  }, []);

  useEffect(() => { connect(); return () => wsRef.current?.close(); }, [connect]);
  return { bins, sweepCount, peakDbm, wsStatus, lastSweepTs };
}

// ---------------------------------------------------------------------------
// RF Alert hook
// ---------------------------------------------------------------------------

function useRecentRfAlerts() {
  return useQuery<RfAlertMapEntry[]>({
    queryKey: ["rf-alerts-recent"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/rf-alerts/recent`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 10_000,
    staleTime: 9_000,
  });
}

// ---------------------------------------------------------------------------
// Band Activity Monitor (compact inline)
// ---------------------------------------------------------------------------

function BandMonitor({ bins, wsStatus, lastSweepTs, sweepCount }: {
  bins: SpectrumBin[];
  wsStatus: "connecting" | "connected" | "error";
  lastSweepTs: number | null;
  sweepCount: number;
}) {
  const stale = lastSweepTs !== null && Date.now() - lastSweepTs > 30_000;
  const live  = wsStatus === "connected" && !stale;

  const bandPeaks: Record<string, number> = {};
  for (const band of DRONE_BANDS) {
    const inBand = bins.filter(b => b.hz >= band.hz_low && b.hz <= band.hz_high);
    if (inBand.length > 0) bandPeaks[band.id] = Math.max(...inBand.map(b => b.dbm));
  }

  return (
    <div className="flex flex-col gap-1.5 py-1">
      {DRONE_BANDS.map(band => {
        const peak = bandPeaks[band.id] ?? null;
        const pct  = peak !== null ? Math.max(0, Math.min(1, (peak - DB_MIN) / (DB_MAX - DB_MIN))) : 0;
        const hot  = peak !== null && peak > -70;

        return (
          <div key={band.id} className="flex items-center gap-2">
            <div className="w-[72px] flex-shrink-0">
              <div className="text-[10px] font-mono font-bold leading-tight" style={{ color: band.color }}>
                {band.label}
              </div>
            </div>
            <div className="flex-1 h-4 bg-white/5 rounded overflow-hidden relative">
              <div
                className="h-full rounded transition-all duration-300"
                style={{
                  width: live && peak !== null ? `${Math.round(pct * 100)}%` : "0%",
                  backgroundColor: band.color,
                  opacity: live ? (hot ? 0.9 : 0.4) : 0.12,
                  boxShadow: live && hot ? `0 0 6px ${band.color}88` : "none",
                }}
              />
              <div className="absolute top-0 bottom-0 w-px bg-white/10" style={{ left: "30%" }} />
            </div>
            <div className="w-14 flex-shrink-0 text-right">
              {live && peak !== null ? (
                <span className="text-[10px] font-mono tabular-nums" style={{ color: hot ? band.color : "rgba(255,255,255,0.25)" }}>
                  {Math.round(peak)} dBm
                </span>
              ) : (
                <span className="text-[10px] font-mono text-muted-foreground/25">---</span>
              )}
            </div>
            <div className="w-3 flex-shrink-0 flex items-center justify-center">
              {live && hot && <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: band.color }} />}
            </div>
          </div>
        );
      })}
      {!live && (
        <div className="text-center text-[10px] font-mono text-muted-foreground/30 uppercase pt-1">
          {wsStatus === "connecting" ? "Свързване…" : stale ? "LINK LOST >30s" : "Изчакване на данни…"}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BLE / WiFi hooks & panel
// ---------------------------------------------------------------------------

interface BleStatus {
  totalScans: number;
  dronesDetected: number;
  adapter: string;
  ts: string;
  receivedAt: string;
}

interface AmbientDevice {
  id: number;
  mac: string;
  name: string | null;
  signalType: "BLE" | "WIFI";
  rssiDbm: number | null;
  vendor: string | null;
  timestamp: string;
}

function useBleStatus() {
  return useQuery<BleStatus | null>({
    queryKey: ["ble-status"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/ble-status`, { credentials: "include" });
      if (res.status === 204) return null;
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
}

function useAmbientDevices() {
  return useQuery<AmbientDevice[]>({
    queryKey: ["ambient-active"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/ambient/active`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15_000,
    staleTime: 12_000,
  });
}

function rssiBar(dbm: number | null): number {
  if (dbm === null) return 0;
  return Math.max(0, Math.min(100, ((dbm + 100) / 70) * 100));
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h`;
}

function BleWifiPanel() {
  const { data: bleStatus } = useBleStatus();
  const { data: ambient = [] } = useAmbientDevices();

  // DroneID scanner heartbeat freshness (sends every ~28s by default)
  const staleSecs = bleStatus
    ? Math.floor((Date.now() - new Date(bleStatus.receivedAt).getTime()) / 1000)
    : null;
  const droneIdAlive = staleSecs !== null && staleSecs < 90;

  // ambient-scanner is WiFi-only; BLE count from ambient will always be 0
  const wifiDevices = ambient.filter(d => d.signalType === "WIFI");
  const sorted = [...wifiDevices].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  ).slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2 border-b border-border/30" style={{ flexShrink: 0 }}>
        <Bluetooth className="w-3.5 h-3.5 text-primary" />
        <span className="font-mono text-xs font-bold text-primary uppercase tracking-wider">DroneID / WiFi</span>
        <div className="ml-auto flex items-center gap-2">
          {wifiDevices.length > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground">
              {wifiDevices.length} AP
            </span>
          )}
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            wifiDevices.length > 0 ? "bg-green-400 animate-pulse" : "bg-muted-foreground/30"
          )} />
        </div>
      </div>

      {/* Stats row: DroneID scanner + WiFi count */}
      <div className="px-3 pt-1.5 pb-1 flex items-center gap-3" style={{ flexShrink: 0 }}>
        {/* DroneID scanner status */}
        <div className="flex items-center gap-1.5">
          <Bluetooth className="w-3 h-3 text-muted-foreground" />
          <span className={cn(
            "text-[10px] font-mono font-bold uppercase",
            droneIdAlive ? "text-green-400" : "text-muted-foreground/40"
          )}>
            {droneIdAlive ? `nRF: LIVE · ${bleStatus!.totalScans.toLocaleString()}` : "nRF: OFF"}
          </span>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <Wifi className="w-3 h-3 text-muted-foreground" />
          <span className={cn(
            "text-[10px] font-mono",
            wifiDevices.length > 0 ? "text-foreground" : "text-muted-foreground/40"
          )}>
            {wifiDevices.length}
          </span>
        </div>
      </div>

      {/* WiFi device list */}
      <div className="flex-1 overflow-hidden px-2 pb-1">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-full gap-2 text-muted-foreground/30">
            <Signal className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono uppercase">Сканира WiFi…</span>
          </div>
        ) : (
          <div className="space-y-0.5">
            {sorted.map(d => {
              const label = d.name || d.vendor || `…${d.mac.slice(-8)}`;
              const bar = rssiBar(d.rssiDbm);
              return (
                <div key={d.id} className="flex items-center gap-2 py-0.5 px-1 rounded hover:bg-white/5 transition-colors">
                  <Wifi className="w-3 h-3 text-green-400/60 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-mono text-foreground/70 truncate">{label}</div>
                    <div className="h-1 bg-white/5 rounded overflow-hidden mt-0.5">
                      <div
                        className="h-full rounded"
                        style={{ width: `${bar}%`, backgroundColor: "#4ade80", opacity: 0.55 }}
                      />
                    </div>
                  </div>
                  <div className="text-[9px] font-mono text-muted-foreground/40 flex-shrink-0 w-8 text-right">
                    {d.rssiDbm !== null ? `${d.rssiDbm}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact history list
// ---------------------------------------------------------------------------

function CompactHistory({ language }: { language: string }) {
  const { data: history = [], isLoading } = useListFlightHistory({ limit: 8 });
  const dateLocale = language === "bg" ? bg : enUS;

  if (isLoading) return (
    <div className="flex items-center justify-center h-16 text-muted-foreground text-xs font-mono">
      <Loader2 className="w-3 h-3 animate-spin mr-2" /> Зареждане…
    </div>
  );

  if (history.length === 0) return (
    <div className="flex flex-col items-center justify-center h-16 text-muted-foreground/40 gap-1">
      <Activity className="w-5 h-5" />
      <span className="text-[10px] font-mono uppercase">Няма записи</span>
    </div>
  );

  return (
    <div className="divide-y divide-border/30">
      {history.map(s => {
        const start = new Date(s.firstSeenAt);
        const dur   = Math.max(1, Math.round((new Date(s.lastSeenAt).getTime() - start.getTime()) / 60000));
        return (
          <div key={s.droneId} className={cn("px-3 py-2 flex items-center gap-2 hover:bg-white/5 transition-colors", s.stillActive && "bg-primary/5")}>
            {s.stillActive && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[11px] font-bold text-foreground flex items-center gap-1.5">
                TRK-{s.droneId.substring(0, 6).toUpperCase()}
                {s.minDistanceM < 100 && <AlertTriangle className="w-3 h-3 text-destructive" />}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono truncate">
                {format(start, "HH:mm")} · {dur}min · {Math.round(s.minDistanceM)}m
              </div>
            </div>
            <ChevronRight className="w-3 h-3 text-muted-foreground/30 flex-shrink-0" />
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active Target Card
// ---------------------------------------------------------------------------

function TargetCard({ track }: { track: DroneTrack }) {
  const { t } = useLanguage();
  return (
    <div className={cn(
      "p-3 rounded-lg border font-mono text-xs transition-colors",
      track.alarmActive
        ? "bg-destructive/10 border-destructive shadow-[0_0_12px_rgba(255,0,0,0.2)]"
        : "bg-background/40 border-border/60 hover:border-primary/40"
    )}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="font-bold flex items-center gap-1.5 text-[11px]">
            {track.alarmActive && <AlertTriangle className="w-3 h-3 text-destructive animate-pulse" />}
            <span className={track.alarmActive ? "text-destructive" : "text-primary"}>
              TRK-{track.droneId.substring(0, 6).toUpperCase()}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 uppercase">
            {track.model || t("telemetry.unknownTarget")} · {track.signalType || "RF"}
          </div>
        </div>
        <div className="text-right">
          <div className={cn("font-bold text-sm", track.alarmActive ? "text-destructive" : "text-foreground")}>
            {Math.round(track.distanceFromHomeM)}m
          </div>
          <div className="text-[10px] text-muted-foreground uppercase">dist</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-border/40">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Navigation className="w-2.5 h-2.5" />
          <span>{track.altitudeM ? `${Math.round(track.altitudeM)}m` : "---"} / {track.speedKmh ? `${Math.round(track.speedKmh)}kph` : "---"}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Radio className="w-2.5 h-2.5" />
          <span>{track.rssiDbm ? `${track.rssiDbm} dBm` : "---"}</span>
        </div>
        {track.pilotLat && (
          <div className="col-span-2 flex items-center gap-1 text-accent pt-1">
            <MapPin className="w-2.5 h-2.5" />
            <span>{track.pilotLat.toFixed(5)}, {track.pilotLng?.toFixed(5)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Home() {
  const { t, language } = useLanguage();
  const { data: config, isLoading: configLoading } = useGetHomeConfig();
  const { data: tracks = [] } = useListActiveDroneTracks({
    query: { refetchInterval: 2000, queryKey: getListActiveDroneTracksQueryKey() }
  });
  const { data: rfAlerts = [] } = useRecentRfAlerts();
  const { bins, sweepCount, peakDbm, wsStatus, lastSweepTs } = useSpectrumWs();

  const hasAlarm = tracks.some(t => t.alarmActive);
  const wsLive   = wsStatus === "connected" && (lastSweepTs === null || Date.now() - lastSweepTs < 30_000);

  const latestRfAlerts = Object.values(
    rfAlerts.reduce((acc, a) => {
      if (!acc[a.bandId] || new Date(a.timestamp) > new Date(acc[a.bandId].timestamp)) acc[a.bandId] = a;
      return acc;
    }, {} as Record<string, RfAlertMapEntry>)
  ).filter(a => a.threat === "high" || a.threat === "medium");

  if (configLoading) return (
    <div className="flex-1 flex items-center justify-center text-primary font-mono text-sm uppercase tracking-widest gap-3">
      <Loader2 className="w-4 h-4 animate-spin" /> {t("home.initializing")}
    </div>
  );

  if (!config) return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-card border border-destructive/50 p-6 rounded-lg text-center">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-lg font-mono font-bold text-destructive mb-2 uppercase">{t("home.configMissingTitle")}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t("home.configMissingDesc")}</p>
      </div>
    </div>
  );

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", overflow: "hidden" }}>
      <AudioAlarm active={hasAlarm} />

      {/* ── Map (left, flex-1) ── */}
      <div className="flex-1 relative min-w-0">
        <RadarMap config={config} activeTracks={tracks} rfAlerts={latestRfAlerts} />

        {/* Breach banner */}
        {hasAlarm && (
          <div className="absolute top-4 left-4 z-[400] bg-destructive text-destructive-foreground px-4 py-2 rounded-md font-mono font-bold text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(255,0,0,0.5)] animate-pulse flex items-center gap-2 border border-destructive-foreground/20">
            <AlertTriangle className="w-4 h-4" />
            {t("home.breach")}
          </div>
        )}

        {/* RF badge (bottom-left over map) */}
        <div className="absolute bottom-6 left-4 z-[400] flex gap-2 flex-wrap">
          {latestRfAlerts.filter(a => a.threat === "high").length > 0 && (
            <div className="flex items-center gap-1.5 bg-black/70 border border-red-500/40 text-red-400 px-2.5 py-1 rounded font-mono text-xs backdrop-blur-sm animate-pulse">
              <Zap className="w-3 h-3" /> HackRF {latestRfAlerts.filter(a => a.threat === "high").length} HIGH
            </div>
          )}
          {latestRfAlerts.filter(a => a.threat === "medium").length > 0 && (
            <div className="flex items-center gap-1.5 bg-black/70 border border-yellow-500/40 text-yellow-400 px-2.5 py-1 rounded font-mono text-xs backdrop-blur-sm">
              <Zap className="w-3 h-3" /> HackRF {latestRfAlerts.filter(a => a.threat === "medium").length} MED
            </div>
          )}
        </div>
      </div>

      {/* ── Command Panel (right, fixed width) ── */}
      <div
        className="border-l border-border bg-card/80 backdrop-blur-md"
        style={{ width: 360, flexShrink: 0, display: "grid", gridTemplateRows: "1fr 230px 150px 150px", overflow: "hidden" }}
      >

        {/* ── Section 1: Active Targets ── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", borderBottom: "1px solid hsl(var(--border) / 0.5)" }}>
          <div className="px-3 py-2 border-b border-border/50 flex items-center gap-2" style={{ flexShrink: 0 }}>
            <Crosshair className="w-3.5 h-3.5 text-primary" />
            <span className="font-mono text-xs font-bold text-primary uppercase tracking-wider">
              {t("telemetry.activeTargets")}
            </span>
            <span className="ml-auto text-xs font-mono text-muted-foreground">
              {tracks.length > 0
                ? <span className="text-primary font-bold">{tracks.length}</span>
                : "0"
              }
            </span>
          </div>
          <ScrollArea style={{ flex: 1, minHeight: 0 }}>
            <div className="p-2 space-y-2">
              {tracks.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-3 text-muted-foreground/30">
                  <Crosshair className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-mono uppercase">{t("telemetry.noTargets")}</span>
                </div>
              ) : (
                tracks.map(track => <TargetCard key={track.droneId} track={track} />)
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ── Section 2: RF Spectrum ── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", borderBottom: "1px solid hsl(var(--border) / 0.5)" }}>
          <div className="px-3 py-2 flex items-center gap-2" style={{ flexShrink: 0 }}>
            <Radio className="w-3.5 h-3.5 text-primary" />
            <span className="font-mono text-xs font-bold text-primary uppercase tracking-wider">
              RF Спектър
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              {wsLive ? (
                <>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    #{sweepCount} · {peakDbm} dBm
                  </span>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                </>
              ) : (
                <>
                  <span className="text-[10px] font-mono text-muted-foreground/50 uppercase">
                    {wsStatus === "connecting" ? "Свързване…" : "Offline"}
                  </span>
                  <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                </>
              )}
            </div>
          </div>
          <div className="px-3 pb-3" style={{ flex: 1, overflow: "hidden" }}>
            <BandMonitor bins={bins} wsStatus={wsStatus} lastSweepTs={lastSweepTs} sweepCount={sweepCount} />
          </div>
        </div>

        {/* ── Section 3: BLE / WiFi ── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", borderBottom: "1px solid hsl(var(--border) / 0.5)" }}>
          <BleWifiPanel />
        </div>

        {/* ── Section 4: History ── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div className="px-3 py-2 flex items-center gap-2 border-b border-border/30" style={{ flexShrink: 0 }}>
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="font-mono text-xs font-bold text-primary uppercase tracking-wider">
              История
            </span>
          </div>
          <ScrollArea style={{ flex: 1, minHeight: 0 }}>
            <CompactHistory language={language} />
          </ScrollArea>
        </div>

      </div>
    </div>
  );
}
