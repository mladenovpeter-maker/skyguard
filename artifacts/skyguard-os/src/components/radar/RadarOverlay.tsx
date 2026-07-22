/**
 * RadarOverlay — SVG radar rings + animated sweep, positioned over Leaflet map.
 * All distances are derived from the map's zoom level (16) and home latitude,
 * so range rings align perfectly with real geography on the map below.
 */
import { useRef, useEffect, useState } from "react";
import type { HomeConfig } from "@workspace/api-client-react";
import type { DroneTrack } from "@workspace/api-client-react";
import type { RfAlertMapEntry } from "./RadarMap";

interface Props {
  config: HomeConfig;
  tracks: DroneTrack[];
  rfAlerts?: RfAlertMapEntry[];
  hasAlarm: boolean;
}

/** Metres per pixel at zoom 16, corrected for latitude. */
function mpp(lat: number) {
  return (156_543.034 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, 16);
}

/** Convert lat/lng offset to SVG pixel offset from map centre. */
function toOffset(homeLat: number, homeLng: number, lat: number, lng: number, scale: number) {
  const dLat = (lat - homeLat) * 111_320;
  const dLng = (lng - homeLng) * 111_320 * Math.cos((homeLat * Math.PI) / 180);
  return { dx: dLng / scale, dy: -dLat / scale };
}

export function RadarOverlay({ config, tracks, rfAlerts = [], hasAlarm }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [dim, setDim] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setDim({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = dim;
  const cx = w / 2;
  const cy = h / 2;
  const scale = mpp(config.lat); // m/px
  const fence = config.geofenceRadiusMeters / scale; // px

  const c = hasAlarm ? "#ff4040" : "#00ff8c";
  const cd = hasAlarm ? "rgba(255,60,60," : "rgba(0,255,140,";

  /* ── Range ring definitions ── */
  const rings = [
    { m: config.geofenceRadiusMeters * 0.33 },
    { m: config.geofenceRadiusMeters * 0.67 },
    { m: config.geofenceRadiusMeters, fence: true },
    { m: config.geofenceRadiusMeters * 2 },
    { m: config.geofenceRadiusMeters * 3 },
  ];

  /* ── Blip positions ── */
  const blips = tracks.map((t) => {
    const { dx, dy } = toOffset(config.lat, config.lng, t.lat, t.lng, scale);
    return { ...t, px: cx + dx, py: cy + dy };
  });

  const ready = w > 0 && h > 0;

  return (
    <div ref={ref} className="absolute inset-0 pointer-events-none" style={{ zIndex: 399 }}>
      <style>{`
        @keyframes sg-sweep { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes sg-ping   { 0%,100%{r:10;opacity:.5} 50%{r:20;opacity:.1} }
      `}</style>

      {ready && (
        <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <defs>
            {/* Sweep sector gradient — trail effect */}
            <radialGradient id="sg-sweep-fade" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
              gradientTransform={`translate(${cx},${cy}) scale(${Math.max(w,h)})`}>
              <stop offset="0"   stopColor={c} stopOpacity="0.35" />
              <stop offset="0.7" stopColor={c} stopOpacity="0.12" />
              <stop offset="1"   stopColor={c} stopOpacity="0"    />
            </radialGradient>
          </defs>

          {/* ── Azimuth lines ── */}
          {[0, 45, 90, 135].map((deg) => {
            const r = deg * Math.PI / 180;
            const ext = Math.max(w, h) * 1.5;
            return (
              <line key={deg}
                x1={cx - ext * Math.cos(r)} y1={cy - ext * Math.sin(r)}
                x2={cx + ext * Math.cos(r)} y2={cy + ext * Math.sin(r)}
                stroke={cd + "0.07)"} strokeWidth={1}
              />
            );
          })}

          {/* ── Range rings ── */}
          {rings.map((ring, i) => {
            const r = ring.m / scale;
            const label = ring.m >= 1000
              ? `${(ring.m / 1000).toFixed(1)}km`
              : `${Math.round(ring.m)}m`;
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={r} fill="none"
                  stroke={(ring as any).fence
                    ? (hasAlarm ? "rgba(255,80,80,0.55)" : "rgba(255,210,0,0.45)")
                    : cd + "0.18)"}
                  strokeWidth={(ring as any).fence ? 1.5 : 1}
                  strokeDasharray={(ring as any).fence ? "8 5" : "3 6"}
                />
                <text x={cx + r + 5} y={cy - 5}
                  fill={cd + "0.38)"} fontSize={10}
                  fontFamily="'Courier New',monospace"
                >{label}</text>
              </g>
            );
          })}

          {/* ── Rotating sweep ── */}
          <g style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: "sg-sweep 5s linear infinite",
          }}>
            {/* Trail — 4 overlapping sectors, decreasing opacity */}
            {[0.28, 0.16, 0.08, 0.03].map((alpha, i) => {
              const span = ((i + 1) * 12) * Math.PI / 180; // 12°, 24°, 36°, 48°
              const ext = Math.max(w, h);
              const x2 = cx + ext * Math.sin(span);
              const y2 = cy - ext * Math.cos(span);
              const large = span > Math.PI ? 1 : 0;
              return (
                <path key={i}
                  d={`M ${cx} ${cy} L ${cx} ${cy - ext} A ${ext} ${ext} 0 ${large} 1 ${x2} ${y2} Z`}
                  fill={hasAlarm ? `rgba(255,50,50,${alpha})` : `rgba(0,255,140,${alpha})`}
                />
              );
            })}
            {/* Leading edge line */}
            <line x1={cx} y1={cy} x2={cx} y2={cy - Math.max(w, h)}
              stroke={c} strokeWidth={2} strokeOpacity={0.9}
            />
          </g>

          {/* ── Blips (drone positions on map coords) ── */}
          {blips.map((b) => {
            const bc = b.alarmActive ? "#ff3333" : "#00ffaa";
            return (
              <g key={b.droneId}>
                {/* Pulsing ring */}
                {b.alarmActive && (
                  <circle cx={b.px} cy={b.py} r={14} fill="none"
                    stroke="rgba(255,50,50,0.5)" strokeWidth={1.5}
                  >
                    <animate attributeName="r" values="10;20;10" dur="1s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0;0.6" dur="1s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* Blip dot */}
                <circle cx={b.px} cy={b.py} r={5} fill={bc} opacity={0.95}>
                  <filter id={`glow-${b.droneId}`}>
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </circle>
                {/* ID label */}
                <text x={b.px + 8} y={b.py - 5}
                  fill={bc} fontSize={9} fontWeight="bold"
                  fontFamily="'Courier New',monospace" opacity={0.9}
                >TRK-{b.droneId.substring(0, 5).toUpperCase()}</text>
                {b.altitudeM != null && (
                  <text x={b.px + 8} y={b.py + 6}
                    fill={cd + "0.65)"} fontSize={8}
                    fontFamily="'Courier New',monospace"
                  >{Math.round(b.altitudeM)}m</text>
                )}
              </g>
            );
          })}

          {/* ── Home base ── */}
          <circle cx={cx} cy={cy} r={5} fill={c} opacity={0.95} />
          <circle cx={cx} cy={cy} r={12} fill="none" stroke={c} strokeWidth={1.5} opacity={0.0}>
            <animate attributeName="r" values="8;20;8" dur="2.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="2.5s" repeatCount="indefinite" />
          </circle>
          {/* Cross-hair on home */}
          <line x1={cx - 10} y1={cy} x2={cx - 4} y2={cy} stroke={c} strokeWidth={1} opacity={0.7} />
          <line x1={cx + 4}  y1={cy} x2={cx + 10} y2={cy} stroke={c} strokeWidth={1} opacity={0.7} />
          <line x1={cx} y1={cy - 10} x2={cx} y2={cy - 4} stroke={c} strokeWidth={1} opacity={0.7} />
          <line x1={cx} y1={cy + 4}  x2={cx} y2={cy + 10} stroke={c} strokeWidth={1} opacity={0.7} />

          {/* ── Cardinal direction labels ── */}
          {[
            { l: "N", x: cx,     y: 18 },
            { l: "S", x: cx,     y: h - 6 },
            { l: "E", x: w - 10, y: cy + 4 },
            { l: "W", x: 10,     y: cy + 4 },
          ].map(({ l, x, y }) => (
            <text key={l} x={x} y={y} textAnchor="middle"
              fill={cd + "0.35)"} fontSize={11} fontWeight="bold"
              fontFamily="'Courier New',monospace" letterSpacing={2}
            >{l}</text>
          ))}

          {/* ── Corner HUD brackets ── */}
          {[
            [10, 10, 1, 1], [w - 10, 10, -1, 1],
            [10, h - 10, 1, -1], [w - 10, h - 10, -1, -1],
          ].map(([x, y, sx, sy], i) => (
            <g key={i} stroke={cd + "0.3)"} strokeWidth={2} fill="none">
              <polyline points={`${x + sx * 18},${y} ${x},${y} ${x},${y + sy * 18}`} />
            </g>
          ))}

          {/* ── Status text ── */}
          <text x={20} y={h - 10}
            fill={cd + "0.28)"} fontSize={9} fontFamily="'Courier New',monospace"
          >{config.lat.toFixed(4)}°N {config.lng.toFixed(4)}°E</text>
          <text x={w - 10} y={h - 10} textAnchor="end"
            fill={cd + "0.28)"} fontSize={9} fontFamily="'Courier New',monospace"
          >RNG {Math.round(config.geofenceRadiusMeters * 3)}m</text>
        </svg>
      )}
    </div>
  );
}
