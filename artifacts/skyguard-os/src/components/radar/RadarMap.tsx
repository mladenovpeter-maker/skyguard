import { MapContainer, TileLayer, Circle, Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import { Icon, DivIcon } from "leaflet";
import { DroneTrack, HomeConfig } from "@workspace/api-client-react";
import { useEffect } from "react";
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

const createAmbientIcon = (signalType: string) => {
  const color = signalType === "BLE" ? "#60a5fa" : "#a78bfa"; // blue vs violet
  return new DivIcon({
    className: "bg-transparent",
    html: `<div class="relative w-4 h-4 flex items-center justify-center">
      <div class="absolute w-4 h-4 rounded-full border opacity-40 animate-ping" style="border-color:${color}"></div>
      <div class="w-2 h-2 rounded-full opacity-70" style="background:${color}"></div>
    </div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
};

/** Simple deterministic hash of a string → 0..1 float */
function macToFloat(mac: string): number {
  let h = 0;
  for (let i = 0; i < mac.length; i++) {
    h = (Math.imul(31, h) + mac.charCodeAt(i)) | 0;
  }
  return (h >>> 0) / 0xffffffff;
}

/** Place ambient device near home base using MAC hash for angle, RSSI for distance. */
function ambientPosition(
  homeLat: number,
  homeLng: number,
  mac: string,
  rssiDbm: number | null,
): [number, number] {
  const angle = macToFloat(mac) * 2 * Math.PI;
  // RSSI: -40 strong (close) → -90 weak (far). Map to 50–250 m.
  const rssi = rssiDbm ?? -70;
  const distM = Math.max(50, Math.min(250, 50 + (rssi + 40) * -2.5));
  // Rough metre-to-degree conversion
  const dlat = (distM / 111320) * Math.cos(angle);
  const dlng = (distM / (111320 * Math.cos((homeLat * Math.PI) / 180))) * Math.sin(angle);
  return [homeLat + dlat, homeLng + dlng];
}

export interface AmbientDevice {
  id: number;
  mac: string;
  name: string | null;
  signalType: string;
  rssiDbm: number | null;
  vendor: string | null;
  timestamp: string;
}

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
  ambientDevices?: AmbientDevice[];
}

export function RadarMap({ config, activeTracks, ambientDevices = [] }: RadarMapProps) {
  const hasAlarm = activeTracks.some(t => t.alarmActive);
  
  return (
    <div className={`w-full h-full relative ${hasAlarm ? 'alarm-active' : ''}`}>
      <MapContainer
        center={[config.lat, config.lng]}
        zoom={16}
        className="w-full h-full bg-background"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
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

        {/* Ambient RF devices */}
        {ambientDevices.map(dev => {
          const pos = ambientPosition(config.lat, config.lng, dev.mac, dev.rssiDbm);
          const label = dev.name || dev.vendor || dev.mac;
          const rssiStr = dev.rssiDbm != null ? `${dev.rssiDbm} dBm` : "?";
          return (
            <Marker key={dev.mac} position={pos} icon={createAmbientIcon(dev.signalType)}>
              <Tooltip direction="top" offset={[0, -8]} opacity={0.9}>
                <div className="font-mono text-xs space-y-0.5">
                  <div className="font-bold">{dev.signalType} — {label}</div>
                  <div className="text-muted-foreground">{dev.mac}</div>
                  <div>RSSI: {rssiStr}</div>
                </div>
              </Tooltip>
            </Marker>
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
