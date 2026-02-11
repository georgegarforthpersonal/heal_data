import { useState, useEffect, useMemo } from 'react';
import { Box, Paper, Typography, Slider, Stack, CircularProgress, Alert, ToggleButtonGroup, ToggleButton, Tooltip, IconButton } from '@mui/material';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { LatLngBounds, LatLng } from 'leaflet';
import MapIcon from '@mui/icons-material/Map';
import SatelliteIcon from '@mui/icons-material/Satellite';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import dayjs from 'dayjs';
import 'leaflet/dist/leaflet.css';
import type { SpeciesSightingLocation, LocationWithBoundary } from '../../services/api';
import FieldBoundaryOverlay from '../surveys/FieldBoundaryOverlay';
import { useMapFullscreen, MapResizeHandler } from '../../hooks';

interface SightingsMapProps {
  sightings: SpeciesSightingLocation[];
  loading?: boolean;
  error?: string | null;
  locationsWithBoundaries?: LocationWithBoundary[];
}

/**
 * Component to fit map bounds to markers
 */
function FitBounds({ sightings }: { sightings: SpeciesSightingLocation[] }) {
  const map = useMap();

  useEffect(() => {
    if (sightings.length > 0) {
      const bounds = new LatLngBounds(
        sightings.map(s => new LatLng(s.latitude, s.longitude))
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [sightings, map]);

  return null;
}

/**
 * Get color for a date based on its position in the timeline
 * Returns a color from blue (old) -> purple -> red (new)
 */
function getColorForDate(date: Date, minDate: Date, maxDate: Date): string {
  const range = maxDate.getTime() - minDate.getTime();
  if (range === 0) return '#8B8AC7'; // HEAL purple if all same date

  const position = (date.getTime() - minDate.getTime()) / range;

  // Gradient: Blue (old) -> Purple (mid) -> Red (new)
  if (position < 0.5) {
    // Blue to Purple
    const t = position * 2;
    const r = Math.round(66 + (139 - 66) * t);   // 66 -> 139
    const g = Math.round(133 + (138 - 133) * t); // 133 -> 138
    const b = Math.round(244 + (199 - 244) * t); // 244 -> 199
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Purple to Red
    const t = (position - 0.5) * 2;
    const r = Math.round(139 + (220 - 139) * t);  // 139 -> 220
    const g = Math.round(138 + (38 - 138) * t);   // 138 -> 38
    const b = Math.round(199 + (38 - 199) * t);   // 199 -> 38
    return `rgb(${r}, ${g}, ${b})`;
  }
}

export default function SightingsMap({ sightings, loading, error, locationsWithBoundaries }: SightingsMapProps) {
  // Fullscreen state
  const { isFullscreen, toggleFullscreen, fullscreenContainerSx, fullscreenMapSx } = useMapFullscreen();

  // Map type state
  const [mapType, setMapType] = useState<'street' | 'satellite'>('satellite');

  // Calculate date range for the data
  const dateRange = useMemo(() => {
    if (sightings.length === 0) return null;

    const dates = sightings.map(s => new Date(s.survey_date).getTime());
    const minTime = Math.min(...dates);
    const maxTime = Math.max(...dates);

    return {
      min: new Date(minTime),
      max: new Date(maxTime),
      minTime,
      maxTime
    };
  }, [sightings]);

  // Date range filter state
  const [dateFilterRange, setDateFilterRange] = useState<[number, number]>([
    dateRange?.minTime || 0,
    dateRange?.maxTime || 0
  ]);

  // Update filter range when data changes
  useEffect(() => {
    if (dateRange) {
      setDateFilterRange([dateRange.minTime, dateRange.maxTime]);
    }
  }, [dateRange]);

  // Filter sightings based on date range
  const filteredSightings = useMemo(() => {
    if (!dateRange) return sightings;

    return sightings.filter(s => {
      const time = new Date(s.survey_date).getTime();
      return time >= dateFilterRange[0] && time <= dateFilterRange[1];
    });
  }, [sightings, dateFilterRange, dateRange]);

  // Handle date range change
  const handleDateRangeChange = (_event: Event, newValue: number | number[]) => {
    if (Array.isArray(newValue)) {
      setDateFilterRange([newValue[0], newValue[1]]);
    }
  };

  // Default map center (UK survey area)
  const defaultCenter: [number, number] = [51.159480, -2.385541];
  const defaultZoom = 13;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (sightings.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400,
          color: 'text.secondary'
        }}
      >
        <Typography variant="body1">
          No sighting locations recorded for this species
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Date Range Filter with Map Toggle */}
      {dateRange && dateRange.minTime !== dateRange.maxTime && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Date Range Filter
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Showing {filteredSightings.length} of {sightings.length} sightings
                </Typography>
              </Box>

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
            </Box>

            <Box sx={{ px: 1 }}>
              <Slider
                value={dateFilterRange}
                onChange={handleDateRangeChange}
                min={dateRange.minTime}
                max={dateRange.maxTime}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => dayjs(value).format('MMM DD, YYYY')}
                sx={{
                  '& .MuiSlider-thumb': {
                    bgcolor: '#fff',
                    border: '2px solid #8B8AC7',
                  },
                  '& .MuiSlider-track': {
                    border: 'none',
                    background: 'transparent',
                  },
                  '& .MuiSlider-rail': {
                    opacity: 1,
                    background: 'linear-gradient(to right, rgb(66, 133, 244), rgb(139, 138, 199), rgb(220, 38, 38))',
                    height: 6,
                  },
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {dayjs(dateFilterRange[0]).format('MMM DD, YYYY')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {dayjs(dateFilterRange[1]).format('MMM DD, YYYY')}
                </Typography>
              </Box>
            </Box>
          </Stack>
        </Paper>
      )}

      {/* Map Toggle for single-date datasets */}
      {(!dateRange || dateRange.minTime === dateRange.maxTime) && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Map View
            </Typography>
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
          </Box>
        </Paper>
      )}

      {/* Map */}
      <Paper
        elevation={0}
        className="fullscreen-map-container"
        sx={{
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          position: 'relative',
          ...fullscreenContainerSx,
        }}
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

        <Box sx={{ height: 500, width: '100%', ...fullscreenMapSx }}>
          <MapContainer
            center={defaultCenter}
            zoom={defaultZoom}
            style={{ height: '100%', width: '100%' }}
          >
            {mapType === 'satellite' ? (
              <TileLayer
                key="satellite"
                attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            ) : (
              <TileLayer
                key="street"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            )}

            {/* Field boundaries layer (rendered before markers so markers appear on top) */}
            {locationsWithBoundaries && locationsWithBoundaries.length > 0 && (
              <FieldBoundaryOverlay locations={locationsWithBoundaries} />
            )}

            {filteredSightings.map((sighting) => {
              const sightingDate = new Date(sighting.survey_date);
              const color = dateRange
                ? getColorForDate(sightingDate, dateRange.min, dateRange.max)
                : '#8B8AC7';

              return (
                <CircleMarker
                  key={sighting.id}
                  center={[sighting.latitude, sighting.longitude]}
                  radius={8}
                  pathOptions={{
                    fillColor: color,
                    fillOpacity: 0.7,
                    color: '#fff',
                    weight: 2,
                  }}
                >
                  <Popup>
                    <Box sx={{ p: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {dayjs(sighting.survey_date).format('MMM DD, YYYY')}
                      </Typography>
                      {sighting.breeding_status_code && (
                        <Typography variant="body2" color="text.secondary">
                          <strong>{sighting.breeding_status_code}</strong>
                          {sighting.breeding_status_description && ` - ${sighting.breeding_status_description}`}
                        </Typography>
                      )}
                    </Box>
                  </Popup>
                </CircleMarker>
              );
            })}

            <FitBounds sightings={sightings} />
            <MapResizeHandler isFullscreen={isFullscreen} />
          </MapContainer>
        </Box>
      </Paper>
    </Box>
  );
}
