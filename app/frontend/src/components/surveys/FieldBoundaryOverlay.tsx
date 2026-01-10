/**
 * FieldBoundaryOverlay Component
 *
 * Renders polygon boundaries with labels on Leaflet maps.
 * Used to display predefined field areas (e.g., "Northern", "Southern", "Eastern")
 * as visual reference when recording sightings.
 */

import { Polygon, Tooltip } from 'react-leaflet';
import type { LocationWithBoundary } from '../../services/api';

interface FieldBoundaryOverlayProps {
  locations: LocationWithBoundary[];
  interactive?: boolean; // Whether boundaries respond to hover/click
}

export default function FieldBoundaryOverlay({
  locations,
  interactive = false,
}: FieldBoundaryOverlayProps) {
  // Filter to only locations with boundary geometry
  const locationsWithBoundaries = locations.filter(
    (loc) => loc.boundary_geometry && loc.boundary_geometry.length > 0
  );

  if (locationsWithBoundaries.length === 0) {
    return null;
  }

  return (
    <>
      {locationsWithBoundaries.map((location) => {
        // Convert [lng, lat] (GeoJSON/API format) to [lat, lng] (Leaflet format)
        const positions = location.boundary_geometry!.map(
          ([lng, lat]) => [lat, lng] as [number, number]
        );

        return (
          <Polygon
            key={location.id}
            positions={positions}
            pathOptions={{
              fillColor: location.boundary_fill_color || '#3388ff',
              fillOpacity: location.boundary_fill_opacity || 0.2,
              color: location.boundary_stroke_color || '#3388ff',
              weight: 2,
            }}
            interactive={interactive}
          >
            <Tooltip
              permanent
              direction="center"
              className="field-boundary-label"
            >
              {location.name}
            </Tooltip>
          </Polygon>
        );
      })}
    </>
  );
}
