import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMapEvents, useMap, Popup } from 'react-leaflet';
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
  TextField,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MapIcon from '@mui/icons-material/Map';
import SatelliteIcon from '@mui/icons-material/Satellite';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import 'leaflet/dist/leaflet.css';

import type { BirdSex, BirdPosture, LocationWithBoundary } from '../../services/api';
import { useMapFullscreen, MapResizeHandler } from '../../hooks';
import { BirdObservationFields } from './BirdObservationFields';
import FieldBoundaryOverlay from './FieldBoundaryOverlay';

// Per-individual bird observation fields
export interface IndividualBirdFields {
  sex?: BirdSex | null;
  posture?: BirdPosture | null;
  singing?: boolean | null;
}

// Extended individual location with temp ID for tracking unsaved points
export interface DraftIndividualLocation {
  tempId: string;
  id?: number;
  latitude: number;
  longitude: number;
  count: number;
  // Per-individual bird fields (length should match count for bird species)
  birdFieldsList?: IndividualBirdFields[];
  sex?: BirdSex | null;
  posture?: BirdPosture | null;
  singing?: boolean | null;
  notes?: string | null;
}

interface MultiLocationMapPickerProps {
  locations: DraftIndividualLocation[];
  onChange: (locations: DraftIndividualLocation[]) => void;
  showBirdFields?: boolean;
  maxCount?: number; // Maximum number of individuals allowed (from sighting count)
  disabled?: boolean;
  locationsWithBoundaries?: LocationWithBoundary[]; // Optional locations with boundaries to display on the map
  surveyLocationId?: number | null;
}

// Component to handle map clicks
function MapClickHandler({ onClick, disabled }: { onClick: (latlng: LatLng) => void; disabled?: boolean }) {
  useMapEvents({
    click(e) {
      if (!disabled) {
        onClick(e.latlng);
      }
    },
  });
  return null;
}

// Component to fit map bounds to markers (only on initial mount with pre-existing locations)
function FitBoundsToMarkers({ locations, surveyLocationId, locationsWithBoundaries }: { locations: DraftIndividualLocation[]; surveyLocationId?: number | null; locationsWithBoundaries?: LocationWithBoundary[] }) {
  const map = useMap();
  // Capture whether there were locations when the component first mounted
  const hadInitialLocationsRef = useRef(locations.length > 0);
  const hasFittedRef = useRef(false);

  useEffect(() => {
    // Only fit bounds if there were pre-existing locations when the modal opened
    if (!hasFittedRef.current && hadInitialLocationsRef.current && locations.length > 0) {
      const bounds = locations.map((loc) => [loc.latitude, loc.longitude] as [number, number]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      hasFittedRef.current = true;
    }

    if (!hasFittedRef.current && !hadInitialLocationsRef.current && surveyLocationId && locationsWithBoundaries) {
      const location = locationsWithBoundaries.find(l => l.id === surveyLocationId);
      if (location?.boundary_geometry && location.boundary_geometry.length > 0) {
        const bounds = location.boundary_geometry.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 17 });
        hasFittedRef.current = true;
      }
    }
  }, [locations, map, surveyLocationId, locationsWithBoundaries]);

  return null;
}

export default function MultiLocationMapPicker({
  locations,
  onChange,
  showBirdFields = false,
  maxCount,
  disabled = false,
  locationsWithBoundaries,
  surveyLocationId,
}: MultiLocationMapPickerProps) {
  const [mapType, setMapType] = useState<'street' | 'satellite'>('satellite');
  const [mapCenter] = useState<LatLng>(new LatLng(51.159480, -2.385541));
  const [expandedBirdDetails, setExpandedBirdDetails] = useState<Set<string>>(new Set());
  const { isFullscreen, toggleFullscreen, fullscreenContainerSx, fullscreenMapSx } = useMapFullscreen();

  // Calculate total count across all locations
  const totalCount = locations.reduce((sum, loc) => sum + loc.count, 0);
  const remainingCount = maxCount !== undefined ? maxCount - totalCount : undefined;
  const isAtMax = remainingCount !== undefined && remainingCount <= 0;

  // Handle map click - add new individual location
  const handleMapClick = useCallback(
    (latlng: LatLng) => {
      if (isAtMax) return;

      const newLocation: DraftIndividualLocation = {
        tempId: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        latitude: latlng.lat,
        longitude: latlng.lng,
        count: 1,
        birdFieldsList: showBirdFields ? [{ sex: null, posture: null, singing: null }] : undefined,
        sex: null,
        posture: null,
        singing: null,
        notes: null,
      };
      onChange([...locations, newLocation]);
    },
    [locations, onChange, isAtMax, showBirdFields]
  );

  // Update count for a specific location
  const handleCountChange = useCallback(
    (tempId: string, newCount: number) => {
      // Check if new count would exceed max
      if (maxCount !== undefined) {
        const otherLocationsTotal = locations
          .filter((loc) => loc.tempId !== tempId)
          .reduce((sum, loc) => sum + loc.count, 0);
        const maxAllowed = maxCount - otherLocationsTotal;
        if (newCount > maxAllowed) return;
      }

      onChange(
        locations.map((loc) => {
          if (loc.tempId !== tempId) return loc;
          const updated = { ...loc, count: newCount };
          // Sync birdFieldsList length with count
          if (showBirdFields && updated.birdFieldsList) {
            const currentList = updated.birdFieldsList;
            if (newCount > currentList.length) {
              // Add empty entries for new birds
              updated.birdFieldsList = [
                ...currentList,
                ...Array.from({ length: newCount - currentList.length }, () => ({
                  sex: null as BirdSex | null,
                  posture: null as BirdPosture | null,
                  singing: null as boolean | null,
                })),
              ];
            } else if (newCount < currentList.length) {
              // Trim from the end
              updated.birdFieldsList = currentList.slice(0, newCount);
            }
          } else if (showBirdFields && newCount > 0) {
            // Initialize birdFieldsList if missing
            updated.birdFieldsList = Array.from({ length: newCount }, () => ({
              sex: null as BirdSex | null,
              posture: null as BirdPosture | null,
              singing: null as boolean | null,
            }));
          }
          return updated;
        })
      );
    },
    [locations, onChange, maxCount, showBirdFields]
  );

  // Validate count on blur (ensure at least 1)
  const handleCountBlur = useCallback(
    (tempId: string, currentCount: number) => {
      if (currentCount < 1) {
        onChange(
          locations.map((loc) =>
            loc.tempId === tempId ? { ...loc, count: 1 } : loc
          )
        );
      }
    },
    [locations, onChange]
  );

  // Update bird observation fields for a specific individual at a specific index
  const handleBirdFieldsChange = useCallback(
    (tempId: string, index: number, fields: { sex?: BirdSex | null; posture?: BirdPosture | null; singing?: boolean | null }) => {
      onChange(
        locations.map((loc) => {
          if (loc.tempId !== tempId) return loc;
          if (loc.birdFieldsList) {
            const updatedList = [...loc.birdFieldsList];
            updatedList[index] = { ...updatedList[index], ...fields };
            // Also keep single fields in sync with first bird for backward compat
            const first = updatedList[0];
            return { ...loc, birdFieldsList: updatedList, sex: first?.sex, posture: first?.posture, singing: first?.singing };
          }
          // Fallback: single bird fields (count=1 without birdFieldsList)
          return { ...loc, ...fields };
        })
      );
    },
    [locations, onChange]
  );

  // Remove an individual
  const handleRemoveLocation = useCallback(
    (tempId: string) => {
      onChange(locations.filter((loc) => loc.tempId !== tempId));
    },
    [locations, onChange]
  );

  // Get helper text based on state
  const getHelperText = () => {
    if (locations.length === 0) {
      return 'Click on the map to add a location.';
    }
    if (isAtMax) {
      return `All ${maxCount} individual${maxCount === 1 ? '' : 's'} have been assigned to locations.`;
    }
    if (remainingCount !== undefined && remainingCount > 0) {
      return `${remainingCount} individual${remainingCount === 1 ? '' : 's'} remaining. Click on the map to add another location.`;
    }
    return 'Click on the map to add more locations.';
  };

  // Get progress text
  const getProgressText = () => {
    if (maxCount === undefined) {
      return `${totalCount} individual${totalCount === 1 ? '' : 's'} across ${locations.length} location${locations.length === 1 ? '' : 's'}`;
    }
    return `${totalCount} of ${maxCount} across ${locations.length} location${locations.length === 1 ? '' : 's'}`;
  };

  return (
    <Box>
      {/* Header with progress */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle2">
          Individuals ({getProgressText()})
        </Typography>
        <Stack direction="row" spacing={1}>
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
      <Paper
        elevation={2}
        className="fullscreen-map-container"
        sx={{ mb: 2, overflow: 'hidden', position: 'relative', ...fullscreenContainerSx }}
      >
        {/* Fullscreen toggle */}
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
          <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
            <IconButton
              size="small"
              onClick={toggleFullscreen}
              sx={{
                bgcolor: 'white',
                boxShadow: 2,
                '&:hover': { bgcolor: 'grey.100' },
              }}
            >
              {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>

        <Box sx={{ height: { xs: '250px', sm: '300px' }, width: '100%', ...fullscreenMapSx }}>
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
            <MapClickHandler onClick={handleMapClick} disabled={disabled || isAtMax} />
            <FitBoundsToMarkers locations={locations} surveyLocationId={surveyLocationId} locationsWithBoundaries={locationsWithBoundaries} />
            <MapResizeHandler isFullscreen={isFullscreen} />

            {/* Field boundaries layer (rendered before markers so markers appear on top) */}
            {locationsWithBoundaries && locationsWithBoundaries.length > 0 && (
              <FieldBoundaryOverlay locations={locationsWithBoundaries} />
            )}

            {locations.map((loc, index) => (
              <CircleMarker
                key={loc.tempId}
                center={[loc.latitude, loc.longitude]}
                radius={10}
                pathOptions={{
                  fillColor: '#1976d2',
                  fillOpacity: 0.9,
                  color: '#fff',
                  weight: 2,
                }}
              >
                <Popup>
                  <Box sx={{ minWidth: 120 }}>
                    <Typography variant="body2" fontWeight={600}>
                      Individual {index + 1}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                    </Typography>
                  </Box>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </Box>

        {/* Overlay message when at max */}
        {isAtMax && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              bgcolor: 'rgba(0,0,0,0.7)',
              color: 'white',
              px: 2,
              py: 0.5,
              borderRadius: 1,
              fontSize: '0.75rem',
            }}
          >
            Maximum {maxCount} individual{maxCount === 1 ? '' : 's'} reached
          </Box>
        )}
      </Paper>

      {/* Individual Cards */}
      {locations.length > 0 && (
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          {locations.map((loc, index) => (
            <Paper
              key={loc.tempId}
              elevation={1}
              sx={{
                p: 1.5,
                borderLeft: 4,
                borderLeftColor: 'primary.main',
              }}
            >
              <Stack spacing={1.5}>
                {/* Header row: Location # and delete button */}
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="subtitle2" fontWeight={600}>
                    Location {index + 1}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveLocation(loc.tempId)}
                    disabled={disabled}
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>

                {/* Coordinates */}
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <LocationOnIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                  </Typography>
                </Stack>

                {/* Count input */}
                <Stack direction="row" alignItems="center" spacing={1}>
                  <TextField
                    size="small"
                    type="number"
                    label="Count"
                    value={loc.count || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleCountChange(loc.tempId, val === '' ? 0 : parseInt(val, 10) || 0);
                    }}
                    onBlur={() => handleCountBlur(loc.tempId, loc.count)}
                    disabled={disabled}
                    inputProps={{ min: 1 }}
                    sx={{ width: 100 }}
                  />
                  {maxCount !== undefined && (
                    <Typography variant="caption" color="text.secondary">
                      {remainingCount !== undefined && remainingCount > 0 ? `${remainingCount} remaining` : 'max reached'}
                    </Typography>
                  )}
                </Stack>

                {showBirdFields && loc.count > 0 && (
                  <>
                    <Box
                      onClick={() => {
                        setExpandedBirdDetails((prev) => {
                          const next = new Set(prev);
                          if (next.has(loc.tempId)) next.delete(loc.tempId);
                          else next.add(loc.tempId);
                          return next;
                        });
                      }}
                      sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5, userSelect: 'none' }}
                    >
                      <ExpandMoreIcon
                        sx={{
                          fontSize: 18,
                          color: 'text.secondary',
                          transform: expandedBirdDetails.has(loc.tempId) ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s',
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        Behaviour
                      </Typography>
                    </Box>
                    {expandedBirdDetails.has(loc.tempId) && loc.birdFieldsList && (
                      <Stack spacing={1} sx={{ maxHeight: 160, overflowY: 'auto', mr: -0.5, pr: 0.5 }}>
                        {loc.birdFieldsList.map((bf, bfIndex) => (
                          <Stack key={bfIndex} direction="row" alignItems="center" spacing={1}>
                            {loc.count > 1 && (
                              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 16, textAlign: 'right' }}>
                                {bfIndex + 1}
                              </Typography>
                            )}
                            <BirdObservationFields
                              sex={bf.sex}
                              posture={bf.posture}
                              singing={bf.singing}
                              onChange={(fields) => handleBirdFieldsChange(loc.tempId, bfIndex, fields)}
                              disabled={disabled}
                              compact
                            />
                          </Stack>
                        ))}
                      </Stack>
                    )}
                  </>
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      {/* Empty state */}
      {locations.length === 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 2,
            textAlign: 'center',
            border: '2px dashed',
            borderColor: 'divider',
            bgcolor: 'grey.50',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            No individual locations added yet.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Click on the map to add locations.
          </Typography>
        </Paper>
      )}

      {/* Helper text */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {getHelperText()}
      </Typography>
    </Box>
  );
}
