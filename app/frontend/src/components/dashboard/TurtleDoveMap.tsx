import { useState, useEffect, useMemo } from 'react';
import { Box, Paper, Typography, Stack, CircularProgress, Alert, ToggleButtonGroup, ToggleButton, Tooltip, IconButton } from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { LatLngBounds, LatLng, DivIcon } from 'leaflet';
import MapIcon from '@mui/icons-material/Map';
import SatelliteIcon from '@mui/icons-material/Satellite';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import MicIcon from '@mui/icons-material/Mic';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import PlaceIcon from '@mui/icons-material/Place';
import dayjs from 'dayjs';
import 'leaflet/dist/leaflet.css';
import type { SpeciesSightingLocation, LocationWithBoundary } from '../../services/api';
import FieldBoundaryOverlay from '../surveys/FieldBoundaryOverlay';
import { useMapFullscreen, MapResizeHandler } from '../../hooks';
import { notionColors } from '../../theme';

interface TurtleDoveMapProps {
  sightings: SpeciesSightingLocation[];
  loading?: boolean;
  error?: string | null;
  locationsWithBoundaries?: LocationWithBoundary[];
}

// Survey type configuration using Notion colors for consistency
const SURVEY_TYPE_CONFIG: Record<string, { label: string; bgColor: string; iconColor: string; icon: typeof DirectionsWalkIcon }> = {
  walking: {
    label: 'Walking Survey',
    bgColor: notionColors.green.background,
    iconColor: notionColors.green.text,
    icon: DirectionsWalkIcon,
  },
  audio: {
    label: 'Audio Recording',
    bgColor: notionColors.blue.background,
    iconColor: notionColors.blue.text,
    icon: MicIcon,
  },
  camera: {
    label: 'Camera Trap',
    bgColor: notionColors.orange.background,
    iconColor: notionColors.orange.text,
    icon: PhotoCameraIcon,
  },
  default: {
    label: 'Other',
    bgColor: notionColors.gray.background,
    iconColor: notionColors.gray.text,
    icon: PlaceIcon,
  },
};

// SVG path data for each icon (simplified versions of MUI icons)
const ICON_PATHS: Record<string, string> = {
  walking: 'M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7',
  audio: 'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z',
  camera: 'M9 3L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2h-3.17L15 3H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z',
  default: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
};

/**
 * Get survey type config based on survey_type_name
 */
function getSurveyTypeKey(surveyTypeName: string | null): string {
  if (!surveyTypeName) return 'default';

  const nameLower = surveyTypeName.toLowerCase();
  if (nameLower.includes('walk')) return 'walking';
  if (nameLower.includes('audio')) return 'audio';
  if (nameLower.includes('camera')) return 'camera';

  return 'default';
}

/**
 * Create a DivIcon with SVG icon for survey type
 */
function createSurveyTypeIcon(surveyTypeName: string | null): DivIcon {
  const key = getSurveyTypeKey(surveyTypeName);
  const config = SURVEY_TYPE_CONFIG[key];
  const path = ICON_PATHS[key];

  return new DivIcon({
    className: 'survey-type-marker',
    html: `<div style="
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background-color: ${config.bgColor};
      border-radius: 50%;
      border: 2px solid white;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    ">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="${config.iconColor}">
        <path d="${path}"/>
      </svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
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

export default function TurtleDoveMap({ sightings, loading, error, locationsWithBoundaries }: TurtleDoveMapProps) {
  // Fullscreen state
  const { isFullscreen, toggleFullscreen, fullscreenContainerSx, fullscreenMapSx } = useMapFullscreen();

  // Map type state
  const [mapType, setMapType] = useState<'street' | 'satellite'>('satellite');

  // Group sightings by survey type for legend
  const surveyTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    sightings.forEach(s => {
      const key = getSurveyTypeKey(s.survey_type_name);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [sightings]);

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
          No Turtle Dove sightings recorded
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Map Controls */}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Turtle Dove Sightings
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {sightings.length} total sighting{sightings.length !== 1 ? 's' : ''}
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
      </Paper>

      {/* Legend */}
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
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          Survey Types
        </Typography>
        <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
          {Object.entries(SURVEY_TYPE_CONFIG).filter(([key]) => key !== 'default').map(([key, config]) => {
            const count = surveyTypeCounts[key] || 0;
            const IconComponent = config.icon;
            return (
              <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    bgcolor: config.bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconComponent sx={{ fontSize: 14, color: config.iconColor }} />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {config.label} ({count})
                </Typography>
              </Box>
            );
          })}
        </Stack>
      </Paper>

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

            {/* Field boundaries layer */}
            {locationsWithBoundaries && locationsWithBoundaries.length > 0 && (
              <FieldBoundaryOverlay locations={locationsWithBoundaries} />
            )}

            {/* Sighting markers */}
            {sightings.map((sighting) => {
              const key = getSurveyTypeKey(sighting.survey_type_name);
              const config = SURVEY_TYPE_CONFIG[key];
              const icon = createSurveyTypeIcon(sighting.survey_type_name);
              const IconComponent = config.icon;

              return (
                <Marker
                  key={sighting.id}
                  position={[sighting.latitude, sighting.longitude]}
                  icon={icon}
                >
                  <Popup>
                    <Box sx={{ p: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {dayjs(sighting.survey_date).format('MMM DD, YYYY')}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <IconComponent sx={{ fontSize: 14, color: config.iconColor }} />
                        <Typography variant="body2" color="text.secondary">
                          {config.label}
                        </Typography>
                      </Box>
                      {sighting.breeding_status_code && (
                        <Typography variant="body2" color="text.secondary">
                          <strong>{sighting.breeding_status_code}</strong>
                          {sighting.breeding_status_description && ` - ${sighting.breeding_status_description}`}
                        </Typography>
                      )}
                    </Box>
                  </Popup>
                </Marker>
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
