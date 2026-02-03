import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import { LatLng, DivIcon } from 'leaflet';
import {
  Box,
  Typography,
  Stack,
  Paper,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import LayersIcon from '@mui/icons-material/Layers';
import 'leaflet/dist/leaflet.css';

import type { Species, BreedingStatusCode, LocationWithBoundary } from '../../services/api';
import type { DraftSighting } from './SightingsEditor';
import type { DraftIndividualLocation } from './MultiLocationMapPicker';
import { getMarkersFromSightings, addSpeciesAtLocation, updateMarker, removeMarker } from './mapModeUtils';
import type { MapMarker } from './mapModeUtils';
import { MarkerPopupContent } from './MarkerPopupContent';
import FieldBoundaryOverlay from './FieldBoundaryOverlay';

interface MapModeSightingsProps {
  sightings: DraftSighting[];
  species: Species[];
  breedingCodes?: BreedingStatusCode[];
  onSightingsChange?: (sightings: DraftSighting[]) => void;
  locationsWithBoundaries?: LocationWithBoundary[];
  readOnly?: boolean;
}

function MapClickHandler({ onClick }: { onClick: (latlng: LatLng) => void }) {
  const map = useMap();

  useMapEvents({
    click(e) {
      // Check if a popup is currently open and visible (closeOnClick is
      // disabled on our popups so Leaflet won't close them on map click).
      // We must check isOpen() because _popup can hold a stale reference
      // after React unmounts a Popup component.
      const currentPopup = (map as any)._popup;
      if (currentPopup && currentPopup.isOpen()) {
        map.closePopup();
        return;
      }
      onClick(e.latlng);
    },
  });
  return null;
}

function FitBoundsToMarkers({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  const hadInitialMarkersRef = useRef(markers.length > 0);
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (!hasFittedRef.current && hadInitialMarkersRef.current && markers.length > 0) {
      const bounds = markers.map((m) => [m.latitude, m.longitude] as [number, number]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      hasFittedRef.current = true;
    }
  }, [markers, map]);

  return null;
}

// Simple color palette by species type
const SPECIES_TYPE_COLORS: Record<string, string> = {
  butterfly: '#FF9800',
  bird: '#2196F3',
  moth: '#9C27B0',
  beetle: '#795548',
  spider: '#607D8B',
  fungus: '#4CAF50',
  bat: '#37474F',
  mammal: '#8D6E63',
  reptile: '#689F38',
  amphibian: '#00897B',
  fly: '#78909C',
  'bee-wasp-ant': '#FFC107',
  bug: '#EF5350',
  'dragonfly-damselfly': '#03A9F4',
  'grasshopper-cricket': '#8BC34A',
  insect: '#9E9E9E',
  gall: '#66BB6A',
  woodlouse: '#A1887F',
  mite: '#BDBDBD',
};

function getMarkerColorForSpecies(speciesId: number, speciesList: Species[]): string {
  const sp = speciesList.find((s) => s.id === speciesId);
  if (!sp) return '#9E9E9E';
  return SPECIES_TYPE_COLORS[sp.type] || '#8B8AC7';
}

function createSpeciesCodeIcon(speciesCode: string | null, color: string): DivIcon {
  const displayText = speciesCode || '•';
  const fontSize = speciesCode ? '11px' : '16px';

  return new DivIcon({
    className: 'species-code-marker',
    html: `<div style="
      color: ${color};
      font-weight: bold;
      font-size: ${fontSize};
      font-family: monospace;
      text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0 -1px 0 #fff, 0 1px 0 #fff, -1px 0 0 #fff, 1px 0 0 #fff;
      white-space: nowrap;
      cursor: pointer;
    ">${displayText}</div>`,
    iconSize: [0, 0],
    iconAnchor: speciesCode ? [speciesCode.length * 3.5, 6] : [5, 10],
  });
}

export function MapModeSightings({
  sightings,
  species,
  breedingCodes = [],
  onSightingsChange,
  locationsWithBoundaries,
  readOnly = false,
}: MapModeSightingsProps) {
  const [mapType, setMapType] = useState<'street' | 'satellite'>('satellite');
  const [mapCenter] = useState<LatLng>(new LatLng(51.159480, -2.385541));
  const [addPopupPosition, setAddPopupPosition] = useState<{ lat: number; lng: number } | null>(null);

  const markers = useMemo(() => getMarkersFromSightings(sightings), [sightings]);

  // Count sightings without GPS for the info banner
  const sightingsWithoutGps = useMemo(() => {
    return sightings.filter(
      (s) => s.species_id !== null && (!s.individuals || s.individuals.length === 0)
    ).length;
  }, [sightings]);

  const handleMapClick = useCallback((latlng: LatLng) => {
    setAddPopupPosition({ lat: latlng.lat, lng: latlng.lng });
  }, []);

  const handleAddFromPopup = useCallback(
    (speciesId: number, count: number, breedingStatusCode?: string | null) => {
      if (!addPopupPosition) return;
      const updated = addSpeciesAtLocation(
        sightings,
        addPopupPosition.lat,
        addPopupPosition.lng,
        speciesId,
        count,
        breedingStatusCode
      );
      onSightingsChange(updated);
      setAddPopupPosition(null);
    },
    [addPopupPosition, sightings, onSightingsChange]
  );

  const handleAddPopupClose = useCallback(() => {
    setAddPopupPosition(null);
  }, []);

  const handleMarkerUpdate = useCallback(
    (sightingTempId: string, individualTempId: string, updates: Partial<Pick<DraftIndividualLocation, 'count' | 'breeding_status_code'>>) => {
      const updated = updateMarker(sightings, sightingTempId, individualTempId, updates);
      onSightingsChange(updated);
    },
    [sightings, onSightingsChange]
  );

  const handleMarkerDelete = useCallback(
    (sightingTempId: string, individualTempId: string) => {
      const updated = removeMarker(sightings, sightingTempId, individualTempId);
      onSightingsChange(updated);
    },
    [sightings, onSightingsChange]
  );

  return (
    <Box>
      {/* Map */}
      <Paper elevation={2} sx={{ mb: 2, overflow: 'hidden', position: 'relative' }}>
        <Box sx={{ height: { xs: '350px', sm: '400px', md: '500px' }, width: '100%' }}>
          {/* Map controls overlaid on the map */}
          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 1000,
            }}
          >
            <Tooltip title={mapType === 'satellite' ? 'Switch to street map' : 'Switch to satellite'}>
              <IconButton
                size="small"
                onClick={() => setMapType(mapType === 'satellite' ? 'street' : 'satellite')}
                sx={{
                  bgcolor: 'white',
                  boxShadow: 2,
                  '&:hover': { bgcolor: 'grey.100' },
                }}
              >
                <LayersIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
            {mapType === 'satellite' ? (
              <TileLayer
                key="satellite"
                attribution='Tiles &copy; Esri'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            ) : (
              <TileLayer
                key="street"
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            )}
            {!readOnly && <MapClickHandler onClick={handleMapClick} />}
            <FitBoundsToMarkers markers={markers} />

            {locationsWithBoundaries && locationsWithBoundaries.length > 0 && (
              <FieldBoundaryOverlay locations={locationsWithBoundaries} />
            )}

            {/* Existing markers */}
            {markers.map((marker) => {
              const sp = species.find((s) => s.id === marker.species_id);
              const markerColor = getMarkerColorForSpecies(marker.species_id, species);
              const speciesCode = sp?.species_code || null;
              const icon = createSpeciesCodeIcon(speciesCode, markerColor);

              return (
                <Marker
                  key={marker.individualTempId}
                  position={[marker.latitude, marker.longitude]}
                  icon={icon}
                >
                  <Popup
                    closeOnClick={false}
                    autoPan={true}
                    minWidth={readOnly ? 200 : 260}
                    maxWidth={320}
                    className="map-mode-popup"
                  >
                    {readOnly ? (
                      <MarkerPopupContent
                        mode="view"
                        species={species}
                        breedingCodes={breedingCodes}
                        marker={marker}
                      />
                    ) : (
                      <MarkerPopupContent
                        mode="edit"
                        species={species}
                        breedingCodes={breedingCodes}
                        marker={marker}
                        onUpdate={(updates) =>
                          handleMarkerUpdate(marker.sightingTempId, marker.individualTempId, updates)
                        }
                        onDelete={() =>
                          handleMarkerDelete(marker.sightingTempId, marker.individualTempId)
                        }
                      />
                    )}
                  </Popup>
                </Marker>
              );
            })}

            {/* Add popup (opens directly at click location, no marker needed) */}
            {addPopupPosition && (
              <Popup
                position={[addPopupPosition.lat, addPopupPosition.lng]}
                closeOnClick={false}
                autoPan={true}
                minWidth={260}
                maxWidth={320}
                className="map-mode-popup"
                eventHandlers={{
                  remove: handleAddPopupClose,
                }}
              >
                <MarkerPopupContent
                  mode="add"
                  species={species}
                  breedingCodes={breedingCodes}
                  onAdd={handleAddFromPopup}
                  onDiscard={handleAddPopupClose}
                />
              </Popup>
            )}
          </MapContainer>
        </Box>
      </Paper>

      {/* Info banner for sightings without GPS */}
      {sightingsWithoutGps > 0 && (
        <Alert severity="info" sx={{ mb: 1 }}>
          {sightingsWithoutGps} sighting{sightingsWithoutGps > 1 ? 's have' : ' has'} no GPS location and {sightingsWithoutGps > 1 ? 'are' : 'is'} only visible in list mode.
        </Alert>
      )}
    </Box>
  );
}
