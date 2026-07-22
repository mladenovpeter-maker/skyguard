import { useGetHomeConfig, useListActiveDroneTracks, getListActiveDroneTracksQueryKey } from "@workspace/api-client-react";
import { RadarMap, type RfAlertMapEntry } from "@/components/radar/RadarMap";
import { RadarOverlay } from "@/components/radar/RadarOverlay";
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

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      <AudioAlarm active={hasAlarm} />

      {/* ── Map + SVG radar overlay ── */}
      <div className="flex-1 relative min-h-[55vh] md:min-h-0 overflow-hidden">
        {/* Leaflet map — unchanged, all existing markers work */}
        <RadarMap config={config} activeTracks={tracks} rfAlerts={latestRfAlerts} />

        {/* SVG overlay: rings, sweep, cardinal labels, blips */}
        <RadarOverlay
          config={config}
          tracks={tracks}
          rfAlerts={latestRfAlerts}
          hasAlarm={hasAlarm}
        />

        {/* Breach banner */}
        {hasAlarm && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 bg-red-950/90 text-red-300 px-5 py-2 rounded font-mono font-bold text-sm uppercase tracking-widest border border-red-500/50 shadow-[0_0_40px_rgba(255,0,0,0.4)] animate-pulse">
            <AlertTriangle className="w-4 h-4" />
            PERIMETER BREACH
          </div>
        )}
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
