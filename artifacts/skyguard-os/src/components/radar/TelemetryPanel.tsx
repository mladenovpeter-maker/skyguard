import { DroneTrack, HomeConfig } from "@workspace/api-client-react";
import { AlertTriangle, Crosshair, Navigation, Radio, Zap, Shield, Activity, Cpu, Thermometer } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import type { RfAlertMapEntry } from "./RadarMap";
import { useQuery } from "@tanstack/react-query";

// ── Types ────────────────────────────────────────────────────────────────────

interface TelemetryPanelProps {
  tracks: DroneTrack[];
  rfAlerts?: RfAlertMapEntry[];
  config?: HomeConfig;
}

// ── Threat level ─────────────────────────────────────────────────────────────

type ThreatLevel = "NOMINAL" | "GUARDED" | "ELEVATED" | "CRITICAL";

const THREAT: Record<ThreatLevel, { color: string; dimColor: string; label: string; bar: number }> = {
  NOMINAL:  { color: "#22c55e", dimColor: "rgba(34,197,94,0.12)",   label: "NOMINAL",   bar: 1 },
  GUARDED:  { color: "#60a5fa", dimColor: "rgba(96,165,250,0.12)",  label: "GUARDED",   bar: 2 },
  ELEVATED: { color: "#f59e0b", dimColor: "rgba(245,158,11,0.12)",  label: "ELEVATED",  bar: 3 },
  CRITICAL: { color: "#ef4444", dimColor: "rgba(239,68,68,0.14)",   label: "CRITICAL",  bar: 4 },
};

function getThreatLevel(tracks: DroneTrack[], rfAlerts: RfAlertMapEntry[]): ThreatLevel {
  if (tracks.some(t => t.alarmActive)) return "CRITICAL";
  if (tracks.length > 0 || rfAlerts.some(a => a.threat === "high")) return "ELEVATED";
  if (rfAlerts.length > 0) return "GUARDED";
  return "NOMINAL";
}

// ── Time to perimeter ────────────────────────────────────────────────────────

function calcTTP(track: DroneTrack, geofenceR: number): string | null {
  if (!track.speedKmh || track.speedKmh < 0.5) return null;
  const gap = track.distanceFromHomeM - geofenceR;
  if (gap <= 0) return "BREACHED";
  const secs = (gap / 1000) / (track.speedKmh / 3600);
  if (secs < 60) return `${Math.round(secs)}s`;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}m ${s}s`;
}

// ── Pi system vitals ─────────────────────────────────────────────────────────

interface PiVitals {
  cpuPercent: number;
  cpuTempC: number | null;
  memPercent: number;
  uptimeS: number;
  receivedAt: string;
}

function usePiVitals() {
  return useQuery<PiVitals | null>({
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

// ── Sub-components ───────────────────────────────────────────────────────────

function VitalBar({ value, warn = 70, crit = 90 }: { value: number; warn?: number; crit?: number }) {
  const color = value >= crit ? "#ef4444" : value >= warn ? "#f59e0b" : "#22c55e";
  return (
    <div className="flex items-center gap-1.5 flex-1">
      <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          style={{ width: `${Math.min(100, value)}%`, backgroundColor: color, transition: "width 0.6s" }}
          className="h-full rounded-full"
        />
      </div>
      <span className="text-[10px] font-mono w-8 text-right tabular-nums" style={{ color }}>
        {value.toFixed(0)}%
      </span>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-white/5">
        <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-white/25">{label}</span>
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TelemetryPanel({ tracks, rfAlerts = [], config }: TelemetryPanelProps) {
  const { language } = useLanguage();
  const { data: pi } = usePiVitals();
  const piAlive = pi && Date.now() - new Date(pi.receivedAt).getTime() < 90_000;

  const threatLevel = getThreatLevel(tracks, rfAlerts);
  const th = THREAT[threatLevel];
  const geofenceR = config?.geofenceRadiusMeters ?? 300;
  const isCritical = threatLevel === "CRITICAL";

  return (
    <div
      className="w-full md:w-[340px] flex-shrink-0 flex flex-col border-t md:border-t-0 md:border-l border-white/8 bg-[#0a0c0f] overflow-hidden"
      style={{ boxShadow: isCritical ? "inset -1px 0 40px rgba(239,68,68,0.07)" : undefined }}
    >

      {/* ── Header ── */}
      <div
        className="px-4 py-3 border-b border-white/8 flex items-center justify-between flex-shrink-0"
        style={{ backgroundColor: th.dimColor }}
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: th.color }} />
          <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-white/80">
            SkyGuard
          </span>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-widest"
          style={{
            color: th.color,
            backgroundColor: th.dimColor,
            border: `1px solid ${th.color}40`,
            boxShadow: isCritical ? `0 0 12px ${th.color}30` : undefined,
            animation: isCritical ? "pulse 1s ease-in-out infinite" : undefined,
          }}
        >
          {isCritical && <AlertTriangle className="w-3 h-3" />}
          {th.label}
        </div>
      </div>

      {/* ── Threat meter ── */}
      <div className="px-4 py-3 border-b border-white/8 flex-shrink-0">
        <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/25 mb-2">Threat Level</div>
        <div className="flex gap-1.5">
          {(["NOMINAL", "GUARDED", "ELEVATED", "CRITICAL"] as ThreatLevel[]).map((lvl) => {
            const active = THREAT[lvl].bar <= th.bar;
            return (
              <div
                key={lvl}
                className="flex-1 h-1.5 rounded-full transition-all duration-700"
                style={{
                  backgroundColor: active ? THREAT[lvl].color : "rgba(255,255,255,0.05)",
                  boxShadow: active && lvl === threatLevel ? `0 0 6px ${THREAT[lvl].color}` : undefined,
                }}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          {(["NOM", "GRD", "ELV", "CRT"] as const).map((lbl) => (
            <span key={lbl} className="text-[8px] font-mono text-white/15">{lbl}</span>
          ))}
        </div>
      </div>

      {/* ── Active targets ── */}
      <Section label={`Active Targets · ${tracks.length}`}>
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-white/15">
            <Crosshair className="w-7 h-7" />
            <span className="text-[10px] font-mono uppercase tracking-widest">No Contacts</span>
          </div>
        ) : (
          <div className="space-y-2">
            {tracks.map((track) => {
              const alarm = track.alarmActive;
              const ttp = calcTTP(track, geofenceR);
              const ttpColor = ttp === "BREACHED" ? "#ef4444" : ttp ? "#f59e0b" : "#60a5fa";
              return (
                <div
                  key={track.droneId}
                  className="rounded border p-2.5 font-mono text-[11px] transition-all"
                  style={{
                    borderColor: alarm ? "rgba(239,68,68,0.45)" : "rgba(255,255,255,0.08)",
                    backgroundColor: alarm ? "rgba(239,68,68,0.07)" : "rgba(255,255,255,0.03)",
                    boxShadow: alarm ? "0 0 20px rgba(239,68,68,0.15)" : undefined,
                  }}
                >
                  {/* Row 1: ID + distance */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      {alarm && <AlertTriangle className="w-3 h-3 text-red-400 animate-pulse" />}
                      <span
                        className="font-bold tracking-wider text-xs"
                        style={{ color: alarm ? "#ef4444" : "#22d3ee" }}
                      >
                        TRK-{track.droneId.substring(0, 6).toUpperCase()}
                      </span>
                    </div>
                    <span
                      className="font-bold text-sm tabular-nums"
                      style={{ color: alarm ? "#ef4444" : "rgba(255,255,255,0.85)" }}
                    >
                      {Math.round(track.distanceFromHomeM)}m
                    </span>
                  </div>

                  {/* Row 2: model + signal type */}
                  <div className="text-white/35 text-[9px] uppercase tracking-wider mb-2">
                    {track.model ?? "Unknown"} · {track.signalType ?? "RF"}
                  </div>

                  {/* Row 3: metrics grid */}
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white/30 flex items-center gap-0.5"><Navigation className="w-2.5 h-2.5" />ALT</span>
                      <span className="text-white/70 tabular-nums">
                        {track.altitudeM != null ? `${Math.round(track.altitudeM)}m` : "---"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white/30 flex items-center gap-0.5"><Activity className="w-2.5 h-2.5" />SPD</span>
                      <span className="text-white/70 tabular-nums">
                        {track.speedKmh != null ? `${Math.round(track.speedKmh)}km/h` : "---"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white/30 flex items-center gap-0.5"><Radio className="w-2.5 h-2.5" />RSSI</span>
                      <span className="text-white/70 tabular-nums">
                        {track.rssiDbm != null ? `${track.rssiDbm}dBm` : "---"}
                      </span>
                    </div>
                  </div>

                  {/* Row 4: time to perimeter */}
                  {ttp && (
                    <div
                      className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[9px]"
                    >
                      <span className="text-white/25 uppercase tracking-wider">Time to Perimeter</span>
                      <span className="font-bold tracking-widest" style={{ color: ttpColor }}>
                        {ttp}
                      </span>
                    </div>
                  )}

                  {/* Pilot location */}
                  {track.pilotLat && (
                    <div className="mt-1.5 pt-1.5 border-t border-white/5 text-[9px] text-cyan-400/60 tabular-nums">
                      PILOT {track.pilotLat.toFixed(4)}, {track.pilotLng?.toFixed(4)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── RF Detections ── */}
      {rfAlerts.length > 0 && (
        <Section label={`RF Detections · ${rfAlerts.length}`}>
          <div className="space-y-1.5">
            {rfAlerts.map((alert) => {
              const color = alert.threat === "high" ? "#ef4444" : alert.threat === "medium" ? "#f59e0b" : "#a78bfa";
              const drones: string[] = (() => {
                try { return alert.possibleDrones ? JSON.parse(alert.possibleDrones) : []; }
                catch { return []; }
              })();
              return (
                <div
                  key={alert.bandId}
                  className="flex items-start justify-between gap-2 rounded px-2.5 py-2 font-mono text-[10px]"
                  style={{
                    backgroundColor: `${color}08`,
                    border: `1px solid ${color}25`,
                  }}
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-2.5 h-2.5" style={{ color }} />
                      <span className="font-bold text-[11px]" style={{ color }}>{alert.bandLabel}</span>
                    </div>
                    <span className="text-white/30">{(alert.peakHz / 1e6).toFixed(1)} MHz</span>
                    {drones.length > 0 && (
                      <span className="text-white/25 text-[9px]">{drones.slice(0, 2).join(" · ")}</span>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span className="tabular-nums" style={{ color }}>{alert.peakDbm} dBm</span>
                    {alert.aboveBaselineDb != null && (
                      <span className="text-[9px] text-yellow-500/70">+{alert.aboveBaselineDb}dB</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Pi vitals footer ── */}
      {piAlive && pi && (
        <div className="border-t border-white/8 px-4 py-3 flex-shrink-0">
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/20 mb-2 flex items-center gap-1.5">
            <Cpu className="w-3 h-3" /> Sensor Node
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-white/25 w-8">CPU</span>
              <VitalBar value={pi.cpuPercent} />
              {pi.cpuTempC != null && (
                <span
                  className="text-[9px] font-mono tabular-nums flex items-center gap-0.5"
                  style={{ color: pi.cpuTempC >= 75 ? "#ef4444" : pi.cpuTempC >= 60 ? "#f59e0b" : "#22c55e" }}
                >
                  <Thermometer className="w-2.5 h-2.5" />{pi.cpuTempC.toFixed(0)}°
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-white/25 w-8">MEM</span>
              <VitalBar value={pi.memPercent} warn={75} crit={90} />
              <span className="text-[9px] font-mono text-white/20 tabular-nums">
                {Math.floor(pi.uptimeS / 3600)}h{Math.floor((pi.uptimeS % 3600) / 60)}m
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
