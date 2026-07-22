import { useGetHomeConfig, useListActiveDroneTracks, getListActiveDroneTracksQueryKey } from "@workspace/api-client-react";
import { RadarMap, type RfAlertMapEntry } from "@/components/radar/RadarMap";
import { TelemetryPanel } from "@/components/radar/TelemetryPanel";
import { AudioAlarm } from "@/components/radar/AudioAlarm";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";

function useRecentRfAlerts() {
  return useQuery<RfAlertMapEntry[]>({
    queryKey: ["rf-alerts-recent"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/rf-alerts/recent`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15_000,
    staleTime: 14_000,
  });
}

// ── Radar sweep overlay ──────────────────────────────────────────────────────

function RadarSweepOverlay({ hasAlarm }: { hasAlarm: boolean }) {
  const rgb = hasAlarm ? "255,50,50" : "0,255,140";
  return (
    <>
      <style>{`
        @keyframes sg-sweep {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes sg-alarm-glow {
          0%,100% { box-shadow: inset 0 0 0px rgba(255,0,0,0); }
          50%      { box-shadow: inset 0 0 60px rgba(255,0,0,0.18); }
        }
        .sg-alarm-frame { animation: sg-alarm-glow 1.2s ease-in-out infinite; }
      `}</style>

      {/* Rotating sweep */}
      <div className="absolute inset-0 pointer-events-none z-[399] overflow-hidden flex items-center justify-center">
        <div
          style={{
            width: "280vmax",
            height: "280vmax",
            borderRadius: "50%",
            background: `conic-gradient(
              from -8deg,
              transparent 0deg,
              rgba(${rgb},0.13) 18deg,
              rgba(${rgb},0.05) 42deg,
              transparent 42deg
            )`,
            animation: "sg-sweep 5s linear infinite",
          }}
        />
      </div>

      {/* Corner HUD brackets */}
      <div className="absolute top-3 left-3 w-7 h-7 border-t-2 border-l-2 border-primary/50 pointer-events-none z-[400]" />
      <div className="absolute top-3 right-3 w-7 h-7 border-t-2 border-r-2 border-primary/50 pointer-events-none z-[400]" />
      <div className="absolute bottom-3 left-3 w-7 h-7 border-b-2 border-l-2 border-primary/50 pointer-events-none z-[400]" />
      <div className="absolute bottom-3 right-3 w-7 h-7 border-b-2 border-r-2 border-primary/50 pointer-events-none z-[400]" />
    </>
  );
}

// ── Map HUD labels ────────────────────────────────────────────────────────────

function MapHUD({
  lat, lng, trackCount, hasAlarm, rfHighCount,
}: {
  lat: number; lng: number; trackCount: number; hasAlarm: boolean; rfHighCount: number;
}) {
  return (
    <>
      {/* Coordinates */}
      <div className="absolute bottom-8 left-4 z-[400] font-mono text-[10px] text-primary/55 bg-black/50 px-2 py-1 rounded backdrop-blur-sm tracking-wider select-none">
        {lat.toFixed(5)}° N &nbsp; {lng.toFixed(5)}° E
      </div>

      {/* Target counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/40 bg-black/40 px-2 py-0.5 rounded">
          TGT {trackCount.toString().padStart(2, "0")}
        </span>
        {rfHighCount > 0 && (
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-red-400/80 bg-black/40 px-2 py-0.5 rounded animate-pulse">
            RF×{rfHighCount}
          </span>
        )}
      </div>

      {/* Breach banner */}
      {hasAlarm && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-2 bg-destructive/90 text-white px-5 py-2 rounded font-mono font-bold text-sm uppercase tracking-widest shadow-[0_0_40px_rgba(255,0,0,0.55)] animate-pulse border border-red-400/40">
          <AlertTriangle className="w-4 h-4" />
          PERIMETER BREACH
        </div>
      )}
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const { t } = useLanguage();
  const { data: config, isLoading: configLoading } = useGetHomeConfig();
  const { data: tracks = [] } = useListActiveDroneTracks({
    query: { refetchInterval: 2000, queryKey: getListActiveDroneTracksQueryKey() },
  });
  const { data: rfAlerts = [] } = useRecentRfAlerts();

  const hasAlarm = tracks.some(t => t.alarmActive);

  const latestRfAlerts = Object.values(
    rfAlerts.reduce((acc, a) => {
      if (!acc[a.bandId] || new Date(a.timestamp) > new Date(acc[a.bandId].timestamp))
        acc[a.bandId] = a;
      return acc;
    }, {} as Record<string, RfAlertMapEntry>),
  ).filter(a => a.threat === "high" || a.threat === "medium");

  if (configLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-primary font-mono text-sm uppercase tracking-widest gap-3">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t("home.initializing")}
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-card border border-destructive/50 p-6 rounded-lg text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-mono font-bold text-destructive mb-2 uppercase">
            {t("home.configMissingTitle")}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">{t("home.configMissingDesc")}</p>
        </div>
      </div>
    );
  }

  const rfHighCount = latestRfAlerts.filter(a => a.threat === "high").length;

  return (
    <div className={`flex-1 flex flex-col md:flex-row overflow-hidden ${hasAlarm ? "sg-alarm-frame" : ""}`}>
      <AudioAlarm active={hasAlarm} />

      {/* ── Map area ── */}
      <div className="flex-1 relative min-h-[55vh] md:min-h-0">
        <RadarMap config={config} activeTracks={tracks} rfAlerts={latestRfAlerts} />
        <RadarSweepOverlay hasAlarm={hasAlarm} />
        <MapHUD
          lat={config.lat}
          lng={config.lng}
          trackCount={tracks.length}
          hasAlarm={hasAlarm}
          rfHighCount={rfHighCount}
        />
      </div>

      {/* ── Right tactical panel ── */}
      <TelemetryPanel
        tracks={tracks}
        rfAlerts={latestRfAlerts}
        config={config}
      />
    </div>
  );
}
