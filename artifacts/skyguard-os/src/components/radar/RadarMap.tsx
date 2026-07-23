import { MapContainer, TileLayer, Circle, Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import { Icon, DivIcon } from "leaflet";
import { DroneTrack, HomeConfig } from "@workspace/api-client-react";
import { useEffect } from "react";
import { useTheme } from "next-themes";
import "leaflet/dist/leaflet.css";

// Fix leaflet icons
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

const defaultIcon = new Icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const createDroneIcon = (alarm: boolean, heading: number | null) => {
  return new DivIcon({
    className: "bg-transparent",
    html: `<div style="transform: rotate(${heading || 0}deg);" class="relative w-6 h-6 flex items-center justify-center">
      <div class="absolute w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${alarm ? 'border-destructive' : 'border-primary'}"></div>
      <div class="w-2 h-2 rounded-full ${alarm ? 'bg-destructive' : 'bg-primary'}"></div>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

const createPilotIcon = () => {
  return new DivIcon({
    className: "bg-transparent",
    html: `<div class="relative w-6 h-6 flex items-center justify-center">
      <div class="w-3 h-3 rounded-sm bg-accent border border-accent-foreground transform rotate-45"></div>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};



export interface RfAlertMapEntry {
  id: number;
  bandId: string;
  bandLabel: string;
  peakDbm: number;
  peakHz: number;
  threat: string;
  timestamp: string;
  possibleDrones?: string | null;
  aboveBaselineDb?: number | null;
}

// Fixed ring radii per band so they don't overlap
const BAND_RING_RADIUS: Record<string, number> = {
  rc_433:   80,
  rc_868:   110,
  rc_915:   140,
  dji_2400: 180,
  dji_5150: 230,
  dji_5800: 280,
  WIFI_DJI: 120,
};
const DEFAULT_RING_RADIUS = 150;

const THREAT_COLOR: Record<string, string> = {
  high:   "#ef4444",
  medium: "#f59e0b",
  low:    "#a78bfa",
  info:   "#60a5fa",
};

function MapViewUpdater({ lat, lng }: { lat: number, lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

interface RadarMapProps {
  config: HomeConfig;
  activeTracks: DroneTrack[];
  rfAlerts?: RfAlertMapEntry[];
}

export function RadarMap({ config, activeTracks, rfAlerts = [] }: RadarMapProps) {
  const hasAlarm = activeTracks.some(t => t.alarmActive);
  const { theme } = useTheme();
  const tileUrl = theme === "light"
    ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

  return (
    <div className={`w-full h-full relative ${hasAlarm ? 'alarm-active' : ''}`}>
      <MapContainer attributionControl={false}
        center={[config.lat, config.lng]}
        zoom={16}
        className="w-full h-full bg-background"
        zoomControl={false}
      >
        <TileLayer
          key={tileUrl}
          url={tileUrl}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        
        <MapViewUpdater lat={config.lat} lng={config.lng} />

        {/* Home Base */}
        <Circle
          center={[config.lat, config.lng]}
          radius={5}
          pathOptions={{ color: "hsl(var(--primary))", fillColor: "hsl(var(--primary))", fillOpacity: 1 }}
        />

        {/* Geofence */}
        <Circle
          center={[config.lat, config.lng]}
          radius={config.geofenceRadiusMeters}
          pathOptions={{ 
            color: hasAlarm ? "hsl(var(--destructive))" : "hsl(var(--primary))", 
            fillColor: hasAlarm ? "hsl(var(--destructive))" : "hsl(var(--primary))", 
            fillOpacity: 0.1, 
            dashArray: "4 8",
            weight: 2
          }}
        />

        {/* HackRF RF Alert rings — pulsing circles around home base per active band */}
        {rfAlerts.map((alert, i) => {
          const radius = BAND_RING_RADIUS[alert.bandId] ?? DEFAULT_RING_RADIUS + i * 40;
          const color  = THREAT_COLOR[alert.threat] ?? "#a78bfa";
          const drones: string[] = (() => {
            try { return alert.possibleDrones ? JSON.parse(alert.possibleDrones) : []; }
            catch { return []; }
          })();
          return (
            <Circle
              key={alert.bandId}
              center={[config.lat, config.lng]}
              radius={radius}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.06,
                weight: 2,
                dashArray: "6 4",
                opacity: 0.7,
              }}
            >
              <Tooltip direction="top" permanent={false} opacity={0.95}>
                <div className="font-mono text-xs space-y-1 min-w-[160px]">
                  <div className="font-bold" style={{ color }}>⚡ {alert.bandLabel}</div>
                  <div>{(alert.peakHz / 1e6).toFixed(1)} MHz &nbsp; {alert.peakDbm} dBm</div>
                  {alert.aboveBaselineDb != null && (
                    <div className="text-yellow-500">+{alert.aboveBaselineDb} dB над ambient</div>
                  )}
                  {drones.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-gray-500">
                      <div className="text-gray-400 text-[10px] mb-0.5">Вероятни дронове:</div>
                      {drones.slice(0, 3).map(d => (
                        <div key={d} className="text-[10px]">• {d}</div>
                      ))}
                    </div>
                  )}
                </div>
              </Tooltip>
            </Circle>
          );
        })}

        {/* Drones */}
        {activeTracks.map(track => {
          const positions = track.path.map(p => [p.lat, p.lng] as [number, number]);
          return (
            <div key={track.droneId}>
              {/* Drone Path */}
              {positions.length > 1 && (
                <Polyline
                  positions={positions}
                  pathOptions={{ 
                    color: track.alarmActive ? "hsl(var(--destructive))" : "hsl(var(--primary))", 
                    weight: 2, 
                    opacity: 0.5,
                    dashArray: "4 4"
                  }}
                />
              )}
              
              {/* Drone Position */}
              <Marker
                position={[track.lat, track.lng]}
                icon={createDroneIcon(track.alarmActive, track.headingDeg ?? null)}
              />

              {/* Pilot Position */}
              {track.pilotLat && track.pilotLng && (
                <>
                  <Marker
                    position={[track.pilotLat, track.pilotLng]}
                    icon={createPilotIcon()}
                  />
                  <Polyline
                    positions={[[track.lat, track.lng], [track.pilotLat, track.pilotLng]]}
                    pathOptions={{ color: "hsl(var(--accent))", weight: 1, dashArray: "2 4", opacity: 0.5 }}
                  />
                </>
              )}
            </div>
          );
        })}
      </MapContainer>

      {/* Radar Overlay Effect */}
      <div className="absolute inset-0 pointer-events-none rounded-full border border-primary/20 scale-[2] origin-center opacity-30 shadow-[inset_0_0_100px_rgba(0,150,255,0.2)]">
        <div className="absolute top-1/2 left-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-primary origin-left animate-radar-sweep" />
      </div>
    </div>
  );
}
