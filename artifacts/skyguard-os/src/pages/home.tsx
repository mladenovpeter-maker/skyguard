import { useGetHomeConfig, useListActiveDroneTracks, getListActiveDroneTracksQueryKey } from "@workspace/api-client-react";
import { RadarMap } from "@/components/radar/RadarMap";
import { TelemetryPanel } from "@/components/radar/TelemetryPanel";
import { AudioAlarm } from "@/components/radar/AudioAlarm";
import { AlertTriangle, Loader2 } from "lucide-react";

export default function Home() {
  const { data: config, isLoading: configLoading } = useGetHomeConfig();
  const { data: tracks = [] } = useListActiveDroneTracks({
    query: { refetchInterval: 2000, queryKey: getListActiveDroneTracksQueryKey() }
  });

  const hasAlarm = tracks.some(t => t.alarmActive);

  if (configLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-primary font-mono text-sm uppercase tracking-widest gap-3">
        <Loader2 className="w-4 h-4 animate-spin" /> Initializing Radar Systems...
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-card border border-destructive/50 p-6 rounded-lg text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-mono font-bold text-destructive mb-2 uppercase">System Configuration Missing</h2>
          <p className="text-sm text-muted-foreground mb-4">Please navigate to Settings to configure the home property coordinates and geofence radius before initiating tracking.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <AudioAlarm active={hasAlarm} />
      
      {/* Map View */}
      <div className="flex-1 relative">
        <RadarMap config={config} activeTracks={tracks} />
        
        {hasAlarm && (
          <div className="absolute top-4 left-4 z-[400] bg-destructive text-destructive-foreground px-4 py-2 rounded-md font-mono font-bold text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(255,0,0,0.5)] animate-pulse flex items-center gap-2 border border-destructive-foreground/20">
            <AlertTriangle className="w-4 h-4" />
            Proximity Breach Detected
          </div>
        )}
      </div>

      {/* Sidebar Panel */}
      <TelemetryPanel tracks={tracks} />
    </div>
  );
}
