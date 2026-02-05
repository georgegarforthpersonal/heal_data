import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { LatLng } from 'leaflet';
import { Box, Typography, TextField, Stack, Paper, IconButton, Tooltip, ToggleButtonGroup, ToggleButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MapIcon from '@mui/icons-material/Map';
import SatelliteIcon from '@mui/icons-material/Satellite';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import 'leaflet/dist/leaflet.css';
import { useMapFullscreen, MapResizeHandler } from '../../hooks';

// Fix for default marker icon in React Leaflet
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface LocationMapPickerProps {
  latitude?: number;
  longitude?: number;
  onChange: (lat: number | null, lng: number | null) => void;
  label?: string;
  helperText?: string;
}

// Component to handle map clicks
function MapClickHandler({ onClick }: { onClick: (latlng: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng);
    },
  });
  return null;
}

export default function LocationMapPicker({
  latitude,
  longitude,
  onChange,
  label = 'Location',
  helperText = 'Click on the map to set the location',
}: LocationMapPickerProps) {
  const [position, setPosition] = useState<LatLng | null>(
    latitude && longitude ? new LatLng(latitude, longitude) : null
  );
  const [mapCenter, setMapCenter] = useState<LatLng>(
    latitude && longitude ? new LatLng(latitude, longitude) : new LatLng(51.159480, -2.385541) // Default to survey area
  );
  const [mapType, setMapType] = useState<'street' | 'satellite'>('satellite');
  const { isFullscreen, toggleFullscreen, fullscreenContainerSx, fullscreenMapSx } = useMapFullscreen();

  useEffect(() => {
    if (latitude && longitude) {
      const newPos = new LatLng(latitude, longitude);
      setPosition(newPos);
      setMapCenter(newPos);
    }
  }, [latitude, longitude]);

  const handleMapClick = (latlng: LatLng) => {
    setPosition(latlng);
    onChange(latlng.lat, latlng.lng);
  };

  const handleClearLocation = () => {
    setPosition(null);
    onChange(null, null);
  };

  const handleLatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const lat = parseFloat(e.target.value);
    if (!isNaN(lat) && lat >= -90 && lat <= 90) {
      const lng = position?.lng || 0;
      const newPos = new LatLng(lat, lng);
      setPosition(newPos);
      setMapCenter(newPos);
      onChange(lat, lng);
    }
  };

  const handleLngChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const lng = parseFloat(e.target.value);
    if (!isNaN(lng) && lng >= -180 && lng <= 180) {
      const lat = position?.lat || 0;
      const newPos = new LatLng(lat, lng);
      setPosition(newPos);
      setMapCenter(newPos);
      onChange(lat, lng);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {label}
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1}>
          {position && (
            <Tooltip title="Clear location">
              <IconButton size="small" onClick={handleClearLocation}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>

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

        <Box sx={{ height: { xs: '300px', sm: '400px' }, width: '100%', ...fullscreenMapSx }}>
          <MapContainer
            center={mapCenter}
            zoom={13}
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
            <MapClickHandler onClick={handleMapClick} />
            {position && <Marker position={position} />}
            <MapResizeHandler isFullscreen={isFullscreen} />
          </MapContainer>
        </Box>
      </Paper>

      <Stack direction="row" spacing={2}>
        <TextField
          label="Latitude"
          type="number"
          size="small"
          value={position?.lat.toFixed(6) || ''}
          onChange={handleLatChange}
          inputProps={{ step: 0.000001, min: -90, max: 90 }}
          helperText="-90 to 90"
          fullWidth
        />
        <TextField
          label="Longitude"
          type="number"
          size="small"
          value={position?.lng.toFixed(6) || ''}
          onChange={handleLngChange}
          inputProps={{ step: 0.000001, min: -180, max: 180 }}
          helperText="-180 to 180"
          fullWidth
        />
      </Stack>

      {helperText && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {helperText}
        </Typography>
      )}
    </Box>
  );
}
