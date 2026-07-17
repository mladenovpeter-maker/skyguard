import { useGetHomeConfig, useListActiveDroneTracks, getListActiveDroneTracksQueryKey } from "@workspace/api-client-react";
import { RadarMap, type AmbientDevice, type RfAlertMapEntry } from "@/components/radar/RadarMap";
import { TelemetryPanel } from "@/components/radar/TelemetryPanel";
import { AudioAlarm } from "@/components/radar/AudioAlarm";
import { AlertTriangle, Loader2, Radio, Wifi, Zap } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";

function useAmbientDevices() {
  return useQuery<AmbientDevice[]>({
    queryKey: ["ambient-active"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/ambient/active`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 10_000,
    staleTime: 9_000,
  });
}

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
    query: { refetchInterval: 2000, queryKey: getListActiveDroneTracksQueryKey() }
  });
  const { data: ambientDevices = [] } = useAmbientDevices();
  const { data: rfAlerts = [] } = useRecentRfAlerts();

  const hasAlarm = tracks.some(t => t.alarmActive);
  const bleCount = ambientDevices.filter(d => d.signalType === "BLE").length;
  const wifiCount = ambientDevices.filter(d => d.signalType === "WIFI").length;

  // Deduplicate by bandId — keep latest per band
  const latestRfAlerts = Object.values(
    rfAlerts.reduce((acc, a) => {
      if (!acc[a.bandId] || new Date(a.timestamp) > new Date(acc[a.bandId].timestamp)) {
        acc[a.bandId] = a;
      }
      return acc;
    }, {} as Record<string, RfAlertMapEntry>)
  ).filter(a => a.threat === "high" || a.threat === "medium");

  if (configLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-primary font-mono text-sm uppercase tracking-widest gap-3">
        <Loader2 className="w-4 h-4 animate-spin" /> {t("home.initializing")}
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-card border border-destructive/50 p-6 rounded-lg text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-mono font-bold text-destructive mb-2 uppercase">{t("home.configMissingTitle")}</h2>
          <p className="text-sm text-muted-foreground mb-4">{t("home.configMissingDesc")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <AudioAlarm active={hasAlarm} />
      
      {/* Map View */}
      <div className="flex-1 relative">
        <RadarMap config={config} activeTracks={tracks} ambientDevices={ambientDevices} rfAlerts={latestRfAlerts} />
        
        {hasAlarm && (
          <div className="absolute top-4 left-4 z-[400] bg-destructive text-destructive-foreground px-4 py-2 rounded-md font-mono font-bold text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(255,0,0,0.5)] animate-pulse flex items-center gap-2 border border-destructive-foreground/20">
            <AlertTriangle className="w-4 h-4" />
            {t("home.breach")}
          </div>
        )}

        {/* Ambient RF badge */}
        <div className="absolute bottom-6 left-4 z-[400] flex gap-2 flex-wrap">
          {bleCount > 0 && (
            <div className="flex items-center gap-1.5 bg-black/60 border border-blue-400/30 text-blue-400 px-2.5 py-1 rounded font-mono text-xs backdrop-blur-sm">
              <Radio className="w-3 h-3" />
              BLE {bleCount}
            </div>
          )}
          {wifiCount > 0 && (
            <div className="flex items-center gap-1.5 bg-black/60 border border-violet-400/30 text-violet-400 px-2.5 py-1 rounded font-mono text-xs backdrop-blur-sm">
              <Wifi className="w-3 h-3" />
              WiFi {wifiCount}
            </div>
          )}
          {latestRfAlerts.filter(a => a.threat === "high").length > 0 && (
            <div className="flex items-center gap-1.5 bg-black/60 border border-red-500/40 text-red-400 px-2.5 py-1 rounded font-mono text-xs backdrop-blur-sm animate-pulse">
              <Zap className="w-3 h-3" />
              HackRF {latestRfAlerts.filter(a => a.threat === "high").length} HIGH
            </div>
          )}
          {latestRfAlerts.filter(a => a.threat === "medium").length > 0 && (
            <div className="flex items-center gap-1.5 bg-black/60 border border-yellow-500/40 text-yellow-400 px-2.5 py-1 rounded font-mono text-xs backdrop-blur-sm">
              <Zap className="w-3 h-3" />
              HackRF {latestRfAlerts.filter(a => a.threat === "medium").length} MED
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Panel */}
      <TelemetryPanel tracks={tracks} rfAlerts={latestRfAlerts} />
    </div>
  );
}
