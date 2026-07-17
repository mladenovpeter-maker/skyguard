import { DroneTrack } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { bg, enUS } from "date-fns/locale";
import { AlertTriangle, Crosshair, Navigation, Radio, Activity, MapPin, Zap } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import type { RfAlertMapEntry } from "./RadarMap";

interface TelemetryPanelProps {
  tracks: DroneTrack[];
  rfAlerts?: RfAlertMapEntry[];
}

export function TelemetryPanel({ tracks, rfAlerts = [] }: TelemetryPanelProps) {
  const { t, language } = useLanguage();
  const dateLocale = language === "bg" ? bg : enUS;

  return (
    <div className="w-80 h-full border-l border-border bg-card/80 backdrop-blur-md flex flex-col relative z-10">
      <div className="p-4 border-b border-border/50">
        <h2 className="font-mono text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4" />
          {t("telemetry.activeTargets")} ({tracks.length})
        </h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {tracks.length === 0 ? (
            <div className="text-center p-8 border border-dashed border-border rounded-lg text-muted-foreground flex flex-col items-center gap-2">
              <Crosshair className="w-8 h-8 opacity-20" />
              <span className="text-sm font-mono uppercase">{t("telemetry.noTargets")}</span>
            </div>
          ) : (
            tracks.map(track => (
              <div 
                key={track.droneId} 
                className={cn(
                  "p-3 rounded-lg border font-mono text-xs transition-colors",
                  track.alarmActive 
                    ? "bg-destructive/10 border-destructive shadow-[0_0_15px_rgba(255,0,0,0.2)]" 
                    : "bg-background/50 border-border hover:border-primary/50"
                )}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      {track.alarmActive && <AlertTriangle className="w-3 h-3 text-destructive animate-pulse" />}
                      <span className={track.alarmActive ? "text-destructive" : "text-primary"}>
                        TRK-{track.droneId.substring(0, 6).toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 uppercase">
                      {track.model || t("telemetry.unknownTarget")} • {track.signalType || "RF"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn("font-bold text-sm", track.alarmActive ? "text-destructive" : "text-foreground")}>
                      {Math.round(track.distanceFromHomeM)}m
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase mt-1">{t("telemetry.distance")}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/50">
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground flex items-center gap-1"><Navigation className="w-3 h-3"/> {t("telemetry.altSpd")}</span>
                    <span>{track.altitudeM ? `${Math.round(track.altitudeM)}m` : '---'} / {track.speedKmh ? `${Math.round(track.speedKmh)}kph` : '---'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground flex items-center gap-1"><Radio className="w-3 h-3"/> {t("telemetry.signal")}</span>
                    <span>{track.rssiDbm ? `${track.rssiDbm} dBm` : '---'}</span>
                  </div>
                </div>
                
                {track.pilotLat && (
                  <div className="mt-3 pt-3 border-t border-border/50 flex flex-col gap-1">
                     <span className="text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3"/> {t("telemetry.pilotLoc")}</span>
                     <span className="text-accent">{track.pilotLat.toFixed(5)}, {track.pilotLng?.toFixed(5)}</span>
                  </div>
                )}
                
                <div className="mt-3 text-[10px] text-muted-foreground/50 text-right uppercase">
                  {t("telemetry.lastSeen", { time: formatDistanceToNow(new Date(track.lastSeenAt), { addSuffix: true, locale: dateLocale }) })}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* RF Alerts from HackRF */}
      {rfAlerts.length > 0 && (
        <div className="border-t border-border/50 p-3 space-y-2">
          <div className="font-mono text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            RF засичания ({rfAlerts.length})
          </div>
          {rfAlerts.map(alert => {
            const drones: string[] = (() => {
              try { return alert.possibleDrones ? JSON.parse(alert.possibleDrones) : []; }
              catch { return []; }
            })();
            const color = alert.threat === "high" ? "#ef4444" : alert.threat === "medium" ? "#f59e0b" : "#a78bfa";
            return (
              <div key={alert.bandId} className="rounded border p-2 text-[10px] font-mono space-y-1" style={{ borderColor: color + "40", backgroundColor: color + "08" }}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs" style={{ color }}>{alert.bandLabel}</span>
                  <span className="text-muted-foreground">{alert.peakDbm} dBm</span>
                </div>
                <div className="text-muted-foreground">{(alert.peakHz / 1e6).toFixed(1)} MHz</div>
                {drones.length > 0 && (
                  <div className="text-muted-foreground/80">
                    {drones.slice(0, 2).join(" · ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
