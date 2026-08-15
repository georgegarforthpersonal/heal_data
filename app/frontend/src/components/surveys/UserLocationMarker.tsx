import { useEffect, useState } from 'react';
import { CircleMarker, Circle } from 'react-leaflet';

interface Position {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/**
 * The surveyor's live GPS position: a blue dot with an accuracy circle,
 * updated via watchPosition while the map is on screen. Display only — it
 * never moves the map, so it can't fight the user's own panning mid-entry.
 * Renders nothing when geolocation is unavailable or permission is denied.
 */
export default function UserLocationMarker() {
  const [position, setPosition] = useState<Position | null>(null);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => {
        // Denied or unavailable — the dot simply doesn't show.
        setPosition(null);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  if (!position) return null;

  const center: [number, number] = [position.latitude, position.longitude];
  return (
    <>
      {position.accuracy > 15 && (
        <Circle
          center={center}
          radius={position.accuracy}
          pathOptions={{ color: '#1976d2', weight: 1, opacity: 0.4, fillOpacity: 0.08 }}
          interactive={false}
        />
      )}
      <CircleMarker
        center={center}
        radius={7}
        pathOptions={{ color: 'white', weight: 2, fillColor: '#1976d2', fillOpacity: 1 }}
        interactive={false}
      />
    </>
  );
}
