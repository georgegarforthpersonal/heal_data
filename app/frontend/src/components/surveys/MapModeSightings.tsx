import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents, useMap } from 'react-leaflet';
import { LatLng } from 'leaflet';
import {
  Box,
  Typography,
  Stack,
  Paper,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
} from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import MapIcon from '@mui/icons-material/Map';
import SatelliteIcon from '@mui/icons-material/Satellite';
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
  onSightingsChange: (sightings: DraftSighting[]) => void;
  locationsWithBoundaries?: LocationWithBoundary[];
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

export function MapModeSightings({
  sightings,
  species,
  breedingCodes = [],
  onSightingsChange,
  locationsWithBoundaries,
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

  const handleUseCurrentLocation = useCallback(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setAddPopupPosition({ lat: latitude, lng: longitude });
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Unable to get your current location. Please check your browser permissions.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  }, []);

  return (
    <Box>
      {/* Map controls */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Click on the map to add sightings
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Add current GPS location">
            <IconButton size="small" onClick={handleUseCurrentLocation}>
              <MyLocationIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <ToggleButtonGroup
            value={mapType}
            exclusive
            onChange={(_, newValue) => newValue && setMapType(newValue)}
            size="small"
            sx={{ height: '32px' }}
          >
            <ToggleButton value="street" aria-label="street map">
              <Tooltip title="Street Map">
                <MapIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="satellite" aria-label="satellite view">
              <Tooltip title="Satellite View">
                <SatelliteIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      {/* Map */}
      <Paper elevation={2} sx={{ mb: 2, overflow: 'hidden' }}>
        <Box sx={{ height: { xs: '350px', sm: '400px', md: '500px' }, width: '100%' }}>
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
            <MapClickHandler onClick={handleMapClick} />
            <FitBoundsToMarkers markers={markers} />

            {locationsWithBoundaries && locationsWithBoundaries.length > 0 && (
              <FieldBoundaryOverlay locations={locationsWithBoundaries} />
            )}

            {/* Existing markers */}
            {markers.map((marker) => {
              const sp = species.find((s) => s.id === marker.species_id);
              const speciesName = sp?.name || sp?.scientific_name || 'Unknown';
              const markerColor = getMarkerColorForSpecies(marker.species_id, species);

              return (
                <CircleMarker
                  key={marker.individualTempId}
                  center={[marker.latitude, marker.longitude]}
                  radius={10}
                  pathOptions={{
                    fillColor: markerColor,
                    fillOpacity: 0.9,
                    color: '#fff',
                    weight: 2,
                  }}
                >
                  <Popup
                    closeOnClick={false}
                    autoPan={true}
                    minWidth={260}
                    maxWidth={320}
                    className="map-mode-popup"
                  >
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
                  </Popup>
                </CircleMarker>
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
