import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Radio, Wifi, Activity, ZapOff } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SpectrumBin {
  hz: number;
  dbm: number;
}

interface SpectrumMessage {
  type: "spectrum";
  data: SpectrumBin[];
  ts: string;
}

interface RfAlert {
  id: number;
  bandId: string;
  bandLabel: string;
  peakDbm: number;
  peakHz: number;
  threat: string;
  timestamp: string;
  possibleDrones?: string | null;   // JSON array string e.g. '["DJI Mini 3 Pro","DJI Mavic 3"]'
  aboveBaselineDb?: number | null;  // dB above ambient baseline
}

interface FreqBand {
  id: string;
  label: string;
  hz_low: number;
  hz_high: number;
  color: string;
  threat: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Known drone frequency bands (mirrors frequencies.json)
// ---------------------------------------------------------------------------

const DRONE_BANDS: FreqBand[] = [
  { id: "rc_433",    label: "RC 433",       hz_low: 430e6,  hz_high: 440e6,  color: "#f59e0b", threat: "medium", description: "RC control (ELRS, LoRa)" },
  { id: "rc_868",    label: "RC 868",       hz_low: 863e6,  hz_high: 870e6,  color: "#f59e0b", threat: "medium", description: "RC control (EU, Crossfire)" },
  { id: "rc_915",    label: "RC 915",       hz_low: 902e6,  hz_high: 928e6,  color: "#f59e0b", threat: "medium", description: "RC control (US, ELRS)" },
  { id: "fpv_1200",  label: "FPV 1.2G",     hz_low: 1080e6, hz_high: 1360e6, color: "#a78bfa", threat: "low",    description: "Analog FPV video" },
  { id: "gps_l1",    label: "GPS L1",       hz_low: 1559e6, hz_high: 1610e6, color: "#60a5fa", threat: "low",    description: "GNSS navigation" },
  { id: "dji_2400",  label: "DJI 2.4G",     hz_low: 2400e6, hz_high: 2484e6, color: "#ef4444", threat: "high",   description: "DJI OcuSync / Remote ID" },
  { id: "dji_5150",  label: "DJI O3 5.1G",  hz_low: 5150e6, hz_high: 5250e6, color: "#ef4444", threat: "high",   description: "DJI O3/O4 low band" },
  { id: "dji_5800",  label: "DJI O3 5.8G",  hz_low: 5725e6, hz_high: 5850e6, color: "#ef4444", threat: "high",   description: "DJI OcuSync 2/3, FPV" },
];

// ---------------------------------------------------------------------------
// Constants for spectrum rendering
// ---------------------------------------------------------------------------

const DB_MIN = -95;
const DB_MAX = -35;

// ---------------------------------------------------------------------------
// Band Activity Monitor — replaces waterfall, works at any sweep rate
// ---------------------------------------------------------------------------

/**
 * For each drone band, finds the peak dBm from the latest sweep bins.
 * Shows animated horizontal bars — reliable regardless of sweep rate.
 */
function BandActivityMonitor({
  bins,
  sweepCount,
  wsStatus,
  lastSweepTs,
}: {
  bins: SpectrumBin[];
  sweepCount: number;
  wsStatus: "connecting" | "connected" | "error";
  lastSweepTs: number | null; // Date.now() of last sweep
}) {
  const stale = lastSweepTs !== null && Date.now() - lastSweepTs > 30_000;
  const live  = wsStatus === "connected" && !stale;

  // Compute peak dBm per band from latest bins
  const bandPeaks: Record<string, number> = {};
  if (bins.length > 0) {
    for (const band of DRONE_BANDS) {
      const inBand = bins.filter(b => b.hz >= band.hz_low && b.hz <= band.hz_high);
      if (inBand.length > 0) {
        bandPeaks[band.id] = Math.max(...inBand.map(b => b.dbm));
      }
    }
  }

  const shownBands = DRONE_BANDS.filter(b => b.threat === "high" || b.threat === "medium");

  return (
    <div className="flex-1 flex flex-col gap-2 p-3 bg-black/30 rounded border border-border/30 min-h-[160px]">
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Band Activity Monitor
        </span>
        <div className="flex items-center gap-2">
          {stale && (
            <span className="text-[10px] font-mono text-destructive uppercase animate-pulse">
              LINK LOST
            </span>
          )}
          {live && (
            <span className="text-[10px] font-mono text-primary/50">
              sweep #{sweepCount}
            </span>
          )}
          <div
            className={`w-1.5 h-1.5 rounded-full ${live ? "bg-green-400 animate-pulse" : stale ? "bg-destructive" : "bg-yellow-400"}`}
          />
        </div>
      </div>

      {/* One row per band */}
      <div className="flex flex-col gap-1.5 flex-1 justify-around">
        {shownBands.map(band => {
          const peak    = bandPeaks[band.id] ?? null;
          const pct     = peak !== null
            ? Math.max(0, Math.min(1, (peak - DB_MIN) / (DB_MAX - DB_MIN)))
            : 0;
          const aboveNoise = peak !== null && peak > -70;

          return (
            <div key={band.id} className="flex items-center gap-3">
              {/* Band label */}
              <div className="w-20 flex-shrink-0">
                <div className="text-[10px] font-mono font-bold" style={{ color: band.color }}>
                  {band.label}
                </div>
                <div className="text-[9px] font-mono text-muted-foreground/50">
                  {(band.hz_low / 1e6).toFixed(0)}M
                </div>
              </div>

              {/* Activity bar */}
              <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden relative">
                <div
                  className="h-full rounded transition-all duration-300"
                  style={{
                    width: live && peak !== null ? `${Math.round(pct * 100)}%` : "0%",
                    backgroundColor: band.color,
                    opacity: live ? (aboveNoise ? 0.9 : 0.45) : 0.15,
                    boxShadow: live && aboveNoise ? `0 0 8px ${band.color}88` : "none",
                  }}
                />
                {/* Noise floor marker at 30% */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-white/10"
                  style={{ left: "30%" }}
                />
              </div>

              {/* dBm value */}
              <div className="w-16 flex-shrink-0 text-right">
                {live && peak !== null ? (
                  <span
                    className="text-[11px] font-mono tabular-nums font-bold"
                    style={{
                      color: aboveNoise ? band.color : "rgba(255,255,255,0.3)",
                    }}
                  >
                    {Math.round(peak)} dBm
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-muted-foreground/30">---</span>
                )}
              </div>

              {/* Alert dot */}
              <div className="w-4 flex-shrink-0 flex items-center justify-center">
                {live && aboveNoise && (
                  <div
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: band.color }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: no data state */}
      {!live && (
        <div className="text-center text-[10px] font-mono text-muted-foreground/40 uppercase pt-1">
          {wsStatus === "connecting" ? "Свързване с HackRF…" : stale ? "Няма данни >30s" : "Изчакване на sweep…"}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spectrum line chart (latest sweep)
// ---------------------------------------------------------------------------

function SpectrumLine({
  bins,
  freqMin,
  freqMax,
  bands,
}: {
  bins: SpectrumBin[];
  freqMin: number;
  freqMax: number;
  bands: FreqBand[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || bins.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Band highlights
    for (const band of bands) {
      const x1 = ((band.hz_low - freqMin) / (freqMax - freqMin)) * W;
      const x2 = ((band.hz_high - freqMin) / (freqMax - freqMin)) * W;
      if (x2 < 0 || x1 > W) continue;
      ctx.fillStyle = band.color + "22";
      ctx.fillRect(Math.max(0, x1), 0, Math.min(W, x2) - Math.max(0, x1), H);
      ctx.strokeStyle = band.color + "88";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(Math.max(0, x1), 0);
      ctx.lineTo(Math.max(0, x1), H);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Spectrum line
    const filtered = bins.filter(b => b.hz >= freqMin && b.hz <= freqMax);
    if (filtered.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = "hsl(210 100% 60%)";
    ctx.lineWidth = 1.5;
    filtered.forEach((b, i) => {
      const x = ((b.hz - freqMin) / (freqMax - freqMin)) * W;
      const y = H - ((b.dbm - DB_MIN) / (DB_MAX - DB_MIN)) * H;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill under line
    ctx.lineTo(((filtered[filtered.length - 1].hz - freqMin) / (freqMax - freqMin)) * W, H);
    ctx.lineTo(((filtered[0].hz - freqMin) / (freqMax - freqMin)) * W, H);
    ctx.closePath();
    ctx.fillStyle = "hsla(210,100%,60%,0.08)";
    ctx.fill();

    // dB grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    [-80, -60, -40].forEach(db => {
      const y = H - ((db - DB_MIN) / (DB_MAX - DB_MIN)) * H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "10px monospace";
      ctx.fillText(`${db}`, 4, y - 2);
    });
  }, [bins, freqMin, freqMax, bands]);

  return (
    <canvas
      ref={canvasRef}
      width={1200}
      height={120}
      className="w-full h-full"
    />
  );
}

// ---------------------------------------------------------------------------
// Frequency axis
// ---------------------------------------------------------------------------

function FreqAxis({ freqMin, freqMax }: { freqMin: number; freqMax: number }) {
  const ticks: number[] = [];
  const stepHz = freqMax - freqMin > 2e9 ? 500e6 : 200e6;
  const start = Math.ceil(freqMin / stepHz) * stepHz;
  for (let hz = start; hz <= freqMax; hz += stepHz) {
    ticks.push(hz);
  }
  return (
    <div className="relative h-5 text-[10px] font-mono text-muted-foreground">
      {ticks.map(hz => (
        <span
          key={hz}
          className="absolute -translate-x-1/2"
          style={{ left: `${((hz - freqMin) / (freqMax - freqMin)) * 100}%` }}
        >
          {hz >= 1e9 ? `${(hz / 1e9).toFixed(1)}G` : `${(hz / 1e6).toFixed(0)}M`}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alert badge
// ---------------------------------------------------------------------------

function ThreatBadge({ threat }: { threat: string }) {
  const cls = {
    high:   "bg-destructive/20 text-destructive border-destructive/40",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
    low:    "bg-violet-500/20 text-violet-400 border-violet-500/40",
    info:   "bg-blue-500/20 text-blue-400 border-blue-500/40",
  }[threat] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${cls}`}>
      {threat}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

// Use nginx proxy path — avoids direct browser→Pi connection issues
const WS_URL = (import.meta.env.VITE_HACKRF_WS_URL as string) ||
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/hackrf-ws`;
const FREQ_MIN_HZ = 400e6;
const FREQ_MAX_HZ = 6000e6;

// ---------------------------------------------------------------------------
// HackRF live badge — animated equalizer bars
// ---------------------------------------------------------------------------

const BAR_COUNT = 7;
const BAR_HEIGHTS = [0.4, 0.7, 0.55, 0.9, 0.65, 0.5, 0.8]; // static base ratios

function HackRFBadge({
  status,
  sweepCount,
  peakDbm,
}: {
  status: "connecting" | "connected" | "error";
  sweepCount: number;
  peakDbm: number | null;
}) {
  const live    = status === "connected";
  const color   = live ? "#22c55e" : status === "connecting" ? "#f59e0b" : "#ef4444";
  const shadow  = live ? "0 0 8px #22c55e88" : "none";

  // Derive bar heights from sweepCount so they change each sweep
  const bars = BAR_HEIGHTS.map((base, i) => {
    if (!live) return 0.15;
    // Use a deterministic "random" based on sweepCount + bar index
    const seed  = ((sweepCount * 37 + i * 13) % 97) / 97;
    return Math.max(0.2, Math.min(1, base * 0.4 + seed * 0.6));
  });

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded border"
      style={{
        borderColor: color + "50",
        backgroundColor: color + "10",
        boxShadow: shadow,
        transition: "box-shadow 0.4s ease",
      }}
    >
      {/* Equalizer bars */}
      <div className="flex items-end gap-[2px]" style={{ height: 16 }}>
        {bars.map((h, i) => (
          <div
            key={i}
            style={{
              width: 3,
              height: Math.round(h * 16),
              backgroundColor: color,
              borderRadius: 1,
              transition: "height 0.5s ease",
              opacity: live ? 0.9 : 0.3,
            }}
          />
        ))}
      </div>

      {/* Label */}
      <div className="flex flex-col leading-none">
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color }}>
          HackRF One
        </span>
        {live ? (
          <span className="text-[8px] text-muted-foreground">
            {sweepCount} sweeps
            {peakDbm !== null && ` · ${peakDbm} dBm`}
          </span>
        ) : (
          <span className="text-[8px]" style={{ color }}>
            {status === "connecting" ? "connecting…" : "offline"}
          </span>
        )}
      </div>

      {/* Status dot */}
      <div
        className={live ? "animate-pulse" : ""}
        style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function Spectrum() {
  const { t } = useLanguage();
  const [bins, setBins] = useState<SpectrumBin[]>([]);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [sweepCount, setSweepCount] = useState(0);
  const [peakDbm, setPeakDbm] = useState<number | null>(null);
  const [lastSweepTs, setLastSweepTs] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // RF Alerts from API
  const { data: rfAlerts = [] } = useQuery<RfAlert[]>({
    queryKey: ["rf-alerts-recent"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/rf-alerts/recent`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 5000,
  });

  const connect = useCallback(() => {
    const old = wsRef.current;
    if (old) { old.onclose = null; old.onerror = null; old.close(); }
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("connected");
      log.info?.("WS connected");
    };

    ws.onmessage = (evt) => {
      try {
        const msg: SpectrumMessage = JSON.parse(evt.data);
        if (msg.type === "spectrum") {
          setBins(msg.data);
          setSweepCount(c => c + 1);
          setLastSweepTs(Date.now());
          if (msg.data.length > 0) {
            const peak = msg.data.reduce((a, b) => b.dbm > a.dbm ? b : a);
            setPeakDbm(Math.round(peak.dbm * 10) / 10);
          }
        }
      } catch {}
    };

    ws.onerror = () => setWsStatus("error");
    ws.onclose = () => {
      setWsStatus("error");
      setTimeout(connect, 3000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  // ── Stale-data watchdog ────────────────────────────────────────────────────
  // If the WS is nominally "connected" but we haven't received a sweep in
  // STALE_MS ms, the hackrf_sweep subprocess on the Pi has likely crashed
  // while the nginx proxy is keeping the TCP connection alive.
  // Force-close so the onclose handler fires and triggers a reconnect.
  const STALE_MS = 15_000;
  useEffect(() => {
    const id = setInterval(() => {
      if (wsStatus === "connected" && lastSweepTs !== null && Date.now() - lastSweepTs > STALE_MS) {
        console.warn("[HackRF] stale — no sweep in >15 s, forcing reconnect");
        const ws = wsRef.current;
        if (ws) {
          ws.onclose = null; // prevent the normal onclose from double-firing
          ws.onerror = null;
          ws.close();
        }
        setWsStatus("error");
        setTimeout(connect, 500);
      }
    }, 5_000);
    return () => clearInterval(id);
  }, [wsStatus, lastSweepTs, connect]);

  const highAlerts = rfAlerts.filter(a => a.threat === "high");

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background text-foreground font-mono">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card/30">
        <div className="flex items-center gap-3">
          <Radio className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            RF Spectrum — {(FREQ_MIN_HZ / 1e6).toFixed(0)}–{(FREQ_MAX_HZ / 1e6).toFixed(0)} MHz
          </span>
        </div>
        <div className="flex items-center gap-3">
          {highAlerts.length > 0 && (
            <div className="flex items-center gap-1.5 animate-pulse text-destructive text-xs font-bold uppercase">
              <AlertTriangle className="w-3.5 h-3.5" />
              {highAlerts.length} DRONE FREQ
            </div>
          )}
          <HackRFBadge status={wsStatus} sweepCount={sweepCount} peakDbm={peakDbm} />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Main spectrum area */}
        <div className="flex-1 flex flex-col p-3 gap-2 min-w-0 min-h-0">

          {/* Band legend */}
          <div className="flex flex-wrap gap-2">
            {DRONE_BANDS.filter(b => b.threat !== "low").map(band => (
              <div
                key={band.id}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px]"
                style={{ borderColor: band.color + "60", backgroundColor: band.color + "10", color: band.color }}
                title={band.description}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: band.color }} />
                {band.label}
              </div>
            ))}
          </div>

          {/* Spectrum line */}
          <div className="relative bg-black/40 rounded border border-border/30" style={{ height: 120 }}>
            {bins.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs uppercase">
                <ZapOff className="w-4 h-4 mr-2" />
                {wsStatus === "error" ? `Няма връзка с HackRF bridge (${WS_URL})` : "Изчакване на данни…"}
              </div>
            ) : (
              <SpectrumLine bins={bins} freqMin={FREQ_MIN_HZ} freqMax={FREQ_MAX_HZ} bands={DRONE_BANDS} />
            )}
          </div>

          {/* Frequency axis */}
          <FreqAxis freqMin={FREQ_MIN_HZ} freqMax={FREQ_MAX_HZ} />

          {/* Band Activity Monitor — replaces unreliable waterfall */}
          <BandActivityMonitor
            bins={bins}
            sweepCount={sweepCount}
            wsStatus={wsStatus}
            lastSweepTs={lastSweepTs}
          />
        </div>

        {/* RF Alerts panel — right on desktop, bottom on mobile */}
        <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-border/50 flex flex-col bg-card/20 max-h-64 lg:max-h-none">
          <div className="px-3 py-2 border-b border-border/50 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-xs font-bold uppercase tracking-widest">RF Alerts</span>
            <span className="ml-auto text-xs text-muted-foreground">последни 10 мин</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {rfAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 p-4">
                <Activity className="w-6 h-6 opacity-30" />
                <span className="text-xs text-center uppercase">Няма засечени сигнали</span>
              </div>
            ) : (
              rfAlerts.map(alert => {
                const drones: string[] = (() => {
                  try { return alert.possibleDrones ? JSON.parse(alert.possibleDrones) : []; }
                  catch { return []; }
                })();
                return (
                <div
                  key={alert.id}
                  className="px-3 py-2 border-b border-border/30 hover:bg-secondary/20 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold" style={{
                      color: alert.threat === "high" ? "#ef4444" : alert.threat === "medium" ? "#f59e0b" : "#a78bfa"
                    }}>
                      {alert.bandLabel}
                    </span>
                    <ThreatBadge threat={alert.threat} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{(alert.peakHz / 1e6).toFixed(1)} MHz</span>
                    <span className={alert.peakDbm > -50 ? "text-destructive" : ""}>{alert.peakDbm} dBm</span>
                    <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                  </div>
                  {alert.aboveBaselineDb != null && (
                    <div className="text-[10px] text-yellow-500/80 mt-0.5">
                      +{alert.aboveBaselineDb} dB над ambient
                    </div>
                  )}
                  {drones.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {drones.slice(0, 3).map(d => (
                        <span key={d} className="text-[9px] px-1.5 py-0.5 rounded bg-secondary/40 text-muted-foreground border border-border/40">
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                );
              })
            )}
          </div>

          {/* Band reference */}
          <div className="border-t border-border/50 p-2">
            <div className="text-[10px] text-muted-foreground uppercase mb-1.5">Drone честоти</div>
            {DRONE_BANDS.filter(b => b.threat === "high" || b.threat === "medium").map(band => (
              <div key={band.id} className="flex items-center gap-1.5 mb-1">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: band.color }} />
                <span className="text-[10px] text-muted-foreground flex-1 truncate">{band.label}</span>
                <span className="text-[10px] text-muted-foreground/60">
                  {(band.hz_low / 1e6).toFixed(0)}–{(band.hz_high / 1e6).toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Suppress undefined log in browser
const log = { info: console.log };
