/**
 * RadarScope — Canvas-based phosphor radar display.
 * Converts real lat/lng → bearing/distance → blips on a circular scope.
 * Sweep line with persistence trail, range rings, azimuth labels.
 */
import { useRef, useEffect, useCallback } from "react";
import type { DroneTrack, HomeConfig } from "@workspace/api-client-react";
import type { RfAlertMapEntry } from "./RadarMap";

interface Props {
  config: HomeConfig;
  tracks: DroneTrack[];
  rfAlerts?: RfAlertMapEntry[];
  hasAlarm: boolean;
}

const TWO_PI = Math.PI * 2;
const ROTATION_MS = 4500; // one full sweep

// ── Geo helpers ──────────────────────────────────────────────────────────────

function toRadarXY(
  homeLat: number, homeLng: number,
  lat: number, lng: number,
  maxRangeM: number, radius: number,
) {
  const dLat = (lat - homeLat) * 111_320;
  const dLng = (lng - homeLng) * 111_320 * Math.cos(homeLat * Math.PI / 180);
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);
  const bearing = Math.atan2(dLng, dLat); // radians from north
  const r = Math.min(dist / maxRangeM, 1.0) * radius;
  return {
    x: r * Math.sin(bearing),
    y: -r * Math.cos(bearing),
    distM: dist,
    bearing,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RadarScope({ config, tracks, rfAlerts = [], hasAlarm }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // blip persistence: map droneId → { x, y, distM, lastSweepT, alarmActive }
  const blipsRef = useRef<Map<string, {
    x: number; y: number; distM: number; lastSweepT: number; alarmActive: boolean;
    track: DroneTrack;
  }>>(new Map());

  const tracksRef    = useRef(tracks);
  const rfAlertsRef  = useRef(rfAlerts);
  const hasAlarmRef  = useRef(hasAlarm);
  tracksRef.current   = tracks;
  rfAlertsRef.current = rfAlerts;
  hasAlarmRef.current = hasAlarm;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(cx, cy) - 28; // scope radius in px
    const maxRangeM = config.geofenceRadiusMeters * 4; // max displayed range

    const alarm = hasAlarmRef.current;
    const primary = alarm ? "#ff3030" : "#00ff88";
    const dim     = alarm ? "rgba(255,40,40," : "rgba(0,255,140,";

    // ── 1. Background ──
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    bg.addColorStop(0,   alarm ? "rgba(30,4,4,1)"   : "rgba(0,12,5,1)");
    bg.addColorStop(0.7, alarm ? "rgba(20,2,2,1)"   : "rgba(0,8,3,1)");
    bg.addColorStop(1,   alarm ? "rgba(10,0,0,1)"   : "rgba(0,4,2,1)");
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TWO_PI);
    ctx.fillStyle = bg;
    ctx.fill();

    // Clip everything to circle from here
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TWO_PI);
    ctx.clip();

    // ── 2. Grid lines (azimuth) ──
    ctx.strokeStyle = dim + "0.07)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TWO_PI - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + radius * Math.cos(a), cy + radius * Math.sin(a));
      ctx.stroke();
    }

    // ── 3. Range rings ──
    const ringRanges = [
      { m: config.geofenceRadiusMeters * 0.5, label: `${Math.round(config.geofenceRadiusMeters * 0.5)}m` },
      { m: config.geofenceRadiusMeters,        label: `${config.geofenceRadiusMeters}m`, isFence: true },
      { m: config.geofenceRadiusMeters * 2,    label: `${Math.round(config.geofenceRadiusMeters * 2)}m` },
      { m: config.geofenceRadiusMeters * 3,    label: `${Math.round(config.geofenceRadiusMeters * 3)}m` },
      { m: maxRangeM,                          label: `${Math.round(maxRangeM)}m` },
    ];
    for (const ring of ringRanges) {
      const r = (ring.m / maxRangeM) * radius;
      if (r > radius) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TWO_PI);
      if ((ring as any).isFence) {
        ctx.strokeStyle = alarm ? "rgba(255,60,60,0.45)" : "rgba(255,220,0,0.35)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 5]);
      } else {
        ctx.strokeStyle = dim + "0.12)";
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Ring label
      ctx.fillStyle = dim + "0.3)";
      ctx.font = "10px 'Courier New', monospace";
      ctx.fillText(ring.label, cx + r + 3, cy - 3);
    }

    // ── 4. Sweep (phosphor trail) ──
    const now = performance.now();
    const sweepAngle = ((now % ROTATION_MS) / ROTATION_MS) * TWO_PI - Math.PI / 2;

    // Trail: 60 steps, ~60° of fade
    const trailSpan = Math.PI / 3;
    for (let i = 60; i >= 0; i--) {
      const a = sweepAngle - (trailSpan * i / 60);
      const alpha = (1 - i / 60) * (alarm ? 0.45 : 0.38);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, a - trailSpan / 61, a);
      ctx.lineTo(cx, cy);
      ctx.fillStyle = dim + alpha + ")";
      ctx.fill();
    }

    // Leading edge line
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + radius * Math.cos(sweepAngle),
      cy + radius * Math.sin(sweepAngle),
    );
    ctx.strokeStyle = primary;
    ctx.lineWidth = 2;
    ctx.shadowColor = primary;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── 5. RF alert rings (around home base, at fixed radii by band) ──
    const BAND_FRAC: Record<string, number> = {
      rc_433: 0.12, rc_868: 0.17, rc_915: 0.22,
      dji_2400: 0.28, dji_5150: 0.36, dji_5800: 0.44, WIFI_DJI: 0.19,
    };
    const THREAT_COLOR: Record<string, string> = {
      high: "#ef4444", medium: "#f59e0b", low: "#a78bfa",
    };
    for (const alert of rfAlertsRef.current) {
      const frac = BAND_FRAC[alert.bandId] ?? 0.25;
      const r = frac * radius;
      const col = THREAT_COLOR[alert.threat] ?? "#a78bfa";
      // Pulse offset
      const pulse = 0.5 + 0.5 * Math.sin(now / 600);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TWO_PI);
      ctx.strokeStyle = col + "80";
      ctx.lineWidth = 1.5 + pulse * 1.5;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Band label at top of ring
      ctx.fillStyle = col + "bb";
      ctx.font = "9px 'Courier New', monospace";
      ctx.fillText(alert.bandLabel, cx + 3, cy - r + 3);
    }

    // ── 6. Blip persistence ──
    // Update blip map from current tracks
    const nowMs = Date.now();
    for (const track of tracksRef.current) {
      const pos = toRadarXY(
        config.lat, config.lng,
        track.lat, track.lng,
        maxRangeM, radius,
      );
      const existing = blipsRef.current.get(track.droneId);
      // Check if sweep just crossed this blip's angle
      const blipAngle = Math.atan2(pos.x, -pos.y); // bearing in sweep-space
      const normalised = ((blipAngle - (sweepAngle + Math.PI / 2) + TWO_PI * 10) % TWO_PI);
      const justSwept = normalised < (trailSpan + 0.15); // sweep just covered this blip
      blipsRef.current.set(track.droneId, {
        x: pos.x, y: pos.y, distM: pos.distM,
        lastSweepT: justSwept ? nowMs : (existing?.lastSweepT ?? 0),
        alarmActive: track.alarmActive,
        track,
      });
    }
    // Remove stale blips
    for (const [id] of blipsRef.current) {
      if (!tracksRef.current.find(t => t.droneId === id))
        blipsRef.current.delete(id);
    }

    // Draw blips
    for (const [, blip] of blipsRef.current) {
      const age = (nowMs - blip.lastSweepT) / ROTATION_MS; // 0..1 per sweep cycle
      const blipAlpha = Math.max(0.15, 1 - age * 0.85);
      const bx = cx + blip.x;
      const by = cy + blip.y;
      const col = blip.alarmActive ? "#ff3333" : "#00ffaa";

      // Glow
      ctx.shadowColor = col;
      ctx.shadowBlur = blip.alarmActive ? 18 : 10;

      // Blip dot
      ctx.beginPath();
      ctx.arc(bx, by, blip.alarmActive ? 5 : 4, 0, TWO_PI);
      ctx.fillStyle = col.slice(0, 7) + Math.round(blipAlpha * 255).toString(16).padStart(2, "0");
      ctx.fill();

      // Pulsing outer ring on alarm
      if (blip.alarmActive) {
        const pr = 8 + 5 * Math.sin(now / 300);
        ctx.beginPath();
        ctx.arc(bx, by, pr, 0, TWO_PI);
        ctx.strokeStyle = `rgba(255,50,50,${blipAlpha * 0.6})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.shadowBlur = 0;

      // ID label
      ctx.fillStyle = dim + Math.round(blipAlpha * 0.9 * 255).toString(16).padStart(2, "0") + ")";
      ctx.font = "bold 9px 'Courier New', monospace";
      const label = `TRK-${blip.track.droneId.substring(0, 5).toUpperCase()}`;
      ctx.fillText(label, bx + 7, by - 4);
      if (blip.track.altitudeM != null) {
        ctx.font = "8px 'Courier New', monospace";
        ctx.fillText(`${Math.round(blip.track.altitudeM)}m`, bx + 7, by + 6);
      }
    }

    ctx.restore(); // end clip

    // ── 7. Scope bezel (ring border) ──
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TWO_PI);
    ctx.strokeStyle = dim + "0.25)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Outer bezel
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 6, 0, TWO_PI);
    ctx.strokeStyle = dim + "0.08)";
    ctx.lineWidth = 10;
    ctx.stroke();

    // ── 8. Cardinal labels ──
    const cardinals = [
      { label: "N", a: -Math.PI / 2 },
      { label: "E", a: 0 },
      { label: "S", a: Math.PI / 2 },
      { label: "W", a: Math.PI },
    ];
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.fillStyle = dim + "0.55)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const { label, a } of cardinals) {
      const lx = cx + (radius + 18) * Math.cos(a);
      const ly = cy + (radius + 18) * Math.sin(a);
      ctx.fillText(label, lx, ly);
    }
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";

    // ── 9. Home base ──
    ctx.shadowColor = alarm ? "#ff4444" : "#00ffcc";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, TWO_PI);
    ctx.fillStyle = alarm ? "#ff4444" : "#00ffcc";
    ctx.fill();
    // Pulsing home ring
    const homeRing = 10 + 4 * Math.sin(now / 800);
    ctx.beginPath();
    ctx.arc(cx, cy, homeRing, 0, TWO_PI);
    ctx.strokeStyle = alarm ? "rgba(255,60,60,0.4)" : "rgba(0,255,200,0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── 10. HUD corners ──
    const corner = 20;
    const pad = 10;
    ctx.strokeStyle = dim + "0.35)";
    ctx.lineWidth = 2;
    // TL
    ctx.beginPath(); ctx.moveTo(pad + corner, pad); ctx.lineTo(pad, pad); ctx.lineTo(pad, pad + corner); ctx.stroke();
    // TR
    ctx.beginPath(); ctx.moveTo(W - pad - corner, pad); ctx.lineTo(W - pad, pad); ctx.lineTo(W - pad, pad + corner); ctx.stroke();
    // BL
    ctx.beginPath(); ctx.moveTo(pad + corner, H - pad); ctx.lineTo(pad, H - pad); ctx.lineTo(pad, H - pad - corner); ctx.stroke();
    // BR
    ctx.beginPath(); ctx.moveTo(W - pad - corner, H - pad); ctx.lineTo(W - pad, H - pad); ctx.lineTo(W - pad, H - pad - corner); ctx.stroke();

    // ── 11. Status text ──
    ctx.font = "9px 'Courier New', monospace";
    ctx.fillStyle = dim + "0.3)";
    ctx.fillText(`${config.lat.toFixed(4)}°N ${config.lng.toFixed(4)}°E`, pad + 4, H - pad - 4);
    ctx.textAlign = "right";
    ctx.fillText(`RNG ${Math.round(maxRangeM)}m`, W - pad - 4, H - pad - 4);
    ctx.textAlign = "start";

    // Scan line timestamp
    const secs = Math.round((now % ROTATION_MS) / 100) / 10;
    ctx.fillStyle = dim + "0.18)";
    ctx.font = "9px 'Courier New', monospace";
    ctx.textAlign = "right";
    ctx.fillText(`SWEEP ${secs.toFixed(1)}s`, W - pad - 4, pad + 14);
    ctx.textAlign = "start";
  }, [config]);

  useEffect(() => {
    let raf: number;
    function loop() {
      draw();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  // Resize canvas to match container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        canvas.width = Math.round(width * devicePixelRatio);
        canvas.height = Math.round(height * devicePixelRatio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.scale(devicePixelRatio, devicePixelRatio);
      }
    });
    ro.observe(canvas.parentElement!);
    return () => ro.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
