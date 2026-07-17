import { useListFlightHistory } from "@workspace/api-client-react";
import { format } from "date-fns";
import { bg, enUS } from "date-fns/locale";
import { Activity, MapPin, Radio, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

export default function History() {
  const { data: history = [], isLoading } = useListFlightHistory({ limit: 50 });
  const { t, language } = useLanguage();
  const dateLocale = language === "bg" ? bg : enUS;

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-3">
          <Activity className="w-5 h-5 md:w-6 md:h-6" />
          {t("history.title")}
        </h1>
        <p className="text-muted-foreground font-mono text-xs md:text-sm mt-2 uppercase">
          {t("history.subtitle")}
        </p>
      </div>

      <div className="flex-1 bg-card border border-border rounded-lg shadow-sm overflow-hidden flex flex-col">
        {/* Desktop table header — hidden on mobile */}
        <div className="hidden md:grid grid-cols-6 gap-4 p-4 border-b border-border bg-muted/50 font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-2">{t("history.table.targetId")}</div>
          <div>{t("history.table.firstDetected")}</div>
          <div>{t("history.table.duration")}</div>
          <div>{t("history.table.minRange")}</div>
          <div>{t("history.table.peakActivity")}</div>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-md" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground font-mono text-sm uppercase flex flex-col items-center gap-3">
              <Activity className="w-8 h-8 opacity-20" />
              {t("history.empty")}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {history.map((session) => {
                const start = new Date(session.firstSeenAt);
                const end   = new Date(session.lastSeenAt);
                const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));

                return (
                  <div key={session.droneId} className={cn("transition-colors hover:bg-muted/20", session.stillActive && "bg-primary/5")}>
                    {/* ── Desktop row ── */}
                    <div className="hidden md:grid grid-cols-6 gap-4 p-4 items-center">
                      <div className="col-span-2 font-mono">
                        <div className="font-bold flex items-center gap-2">
                          {session.stillActive && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                          <span className="text-foreground">TRK-{session.droneId.substring(0, 8).toUpperCase()}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 uppercase flex items-center gap-2">
                          <Radio className="w-3 h-3" />
                          {session.model || t("history.unknownModel")} • {session.signalType || "RF"}
                        </div>
                      </div>
                      <div className="font-mono text-sm text-foreground">
                        <div>{format(start, "MMM dd, yyyy", { locale: dateLocale })}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{format(start, "HH:mm:ss")}</div>
                      </div>
                      <div className="font-mono text-sm text-foreground">
                        {durationMinutes} {t("history.minutes")}
                        <div className="text-xs text-muted-foreground mt-0.5">{session.pointCount} {t("history.points")}</div>
                      </div>
                      <div className="font-mono text-sm">
                        <span className={cn(session.minDistanceM < 100 ? "text-destructive font-bold" : "text-foreground")}>
                          {Math.round(session.minDistanceM)}m
                        </span>
                        {session.minDistanceM < 100 && (
                          <AlertTriangle className="w-3 h-3 text-destructive inline-block ml-1 mb-0.5" />
                        )}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground uppercase space-y-1">
                        <div>{t("history.alt")}: {session.maxAltitudeM ? `${Math.round(session.maxAltitudeM)}m` : "---"}</div>
                        <div>{t("history.spd")}: {session.maxSpeedKmh ? `${Math.round(session.maxSpeedKmh)}kph` : "---"}</div>
                      </div>
                    </div>

                    {/* ── Mobile card ── */}
                    <div className="md:hidden p-4 font-mono">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="font-bold text-sm flex items-center gap-2">
                            {session.stillActive && <span className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />}
                            TRK-{session.droneId.substring(0, 8).toUpperCase()}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 uppercase flex items-center gap-1">
                            <Radio className="w-3 h-3" />
                            {session.model || t("history.unknownModel")}
                          </div>
                        </div>
                        <span className={cn(
                          "text-sm font-bold flex-shrink-0",
                          session.minDistanceM < 100 ? "text-destructive" : "text-foreground"
                        )}>
                          {Math.round(session.minDistanceM)}m
                          {session.minDistanceM < 100 && <AlertTriangle className="w-3 h-3 inline-block ml-1" />}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div>
                          <div className="text-foreground font-bold">{format(start, "HH:mm")}</div>
                          <div>{format(start, "dd MMM", { locale: dateLocale })}</div>
                        </div>
                        <div>
                          <div className="text-foreground font-bold">{durationMinutes}{t("history.minutes")[0]}</div>
                          <div>{session.pointCount} pts</div>
                        </div>
                        <div>
                          <div className="text-foreground font-bold">{session.maxAltitudeM ? `${Math.round(session.maxAltitudeM)}m` : "---"}</div>
                          <div>{session.maxSpeedKmh ? `${Math.round(session.maxSpeedKmh)}kph` : "---"}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
