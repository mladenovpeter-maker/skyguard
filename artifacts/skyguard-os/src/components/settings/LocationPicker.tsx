import { useCallback, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { useTheme } from "next-themes";
import { Icon } from "leaflet";
import { Crosshair, Loader2 } from "lucide-react";
import "leaflet/dist/leaflet.css";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";

import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

const pinIcon = new Icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface LocationPickerProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LocationPicker({ lat, lng, onChange }: LocationPickerProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { theme } = useTheme();
  const tileUrl = theme === "light"
    ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  const [locating, setLocating] = useState(false);
  const hasValidPosition = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
  const center: [number, number] = hasValidPosition ? [lat, lng] : [42.6977, 23.3219];

  const handleUseCurrentLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      toast({
        title: t("settings.map.geoUnsupportedTitle"),
        description: t("settings.map.geoUnsupportedDesc"),
        variant: "destructive",
      });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange(position.coords.latitude, position.coords.longitude);
        setLocating(false);
      },
      () => {
        toast({
          title: t("settings.map.geoErrorTitle"),
          description: t("settings.map.geoErrorDesc"),
          variant: "destructive",
        });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [onChange, t, toast]);

  return (
    <div className="space-y-2">
      <div className="relative w-full h-64 rounded-md overflow-hidden border border-border">
        <MapContainer attributionControl={false}
          key={hasValidPosition ? "positioned" : "default"}
          center={center}
          zoom={hasValidPosition ? 15 : 6}
          className="w-full h-full"
          scrollWheelZoom
        >
          <TileLayer
            url={tileUrl}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          <ClickHandler onPick={onChange} />
          {hasValidPosition && (
            <Marker
              position={[lat, lng]}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target;
                  const position = marker.getLatLng();
                  onChange(position.lat, position.lng);
                },
              }}
            />
          )}
        </MapContainer>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={handleUseCurrentLocation}
          disabled={locating}
          className="absolute top-2 right-2 z-[1000] font-mono uppercase text-xs shadow-md"
        >
          {locating ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Crosshair className="w-3.5 h-3.5 mr-1.5" />
          )}
          {t("settings.map.useCurrentLocation")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground font-mono">{t("settings.map.hint")}</p>
    </div>
  );
}
