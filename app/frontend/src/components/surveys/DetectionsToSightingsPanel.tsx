import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Chip,
} from '@mui/material';
import { AddCircleOutline, CheckCircle, MicNone } from '@mui/icons-material';
import { audioAPI, surveysAPI } from '../../services/api';
import type { SpeciesDetectionSummary, Sighting, DetectionClip, IndividualLocation } from '../../services/api';
import { AudioClipPlayer } from '../audio/AudioClipPlayer';
import { notionColors } from '../../theme';

interface DetectionsToSightingsPanelProps {
  surveyId: number;
  sightings: Sighting[]; // Existing sightings to show which species have been converted
  onSightingsCreated?: () => void;
  refreshTrigger?: number; // Increment to trigger a refresh
}

/** Device info extracted from detections */
interface DeviceInfo {
  device_id: string;
  device_name: string | null;
  device_latitude: number | null;
  device_longitude: number | null;
  location_id: number | null;
  location_name: string | null;
}

/** Species summary reorganized for a specific device */
interface DeviceSpeciesSummary {
  species_id: number;
  species_name: string | null;
  species_scientific_name: string | null;
  detection_count: number;
  top_detections: DetectionClip[];
}

/** All detections grouped by device */
interface DeviceDetections {
  device: DeviceInfo;
  species: DeviceSpeciesSummary[];
  total_detections: number;
}

/** Tolerance for GPS coordinate matching (in degrees, ~0.1m) */
const GPS_TOLERANCE = 0.000001;

/**
 * Check if two GPS coordinates match within tolerance
 */
function coordinatesMatch(
  lat1: number | null | undefined,
  lng1: number | null | undefined,
  lat2: number | null | undefined,
  lng2: number | null | undefined
): boolean {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
    return false;
  }
  return (
    Math.abs(lat1 - lat2) < GPS_TOLERANCE &&
    Math.abs(lng1 - lng2) < GPS_TOLERANCE
  );
}

/**
 * Find an individual in a sighting that matches the device GPS
 */
function findIndividualAtDeviceGps(
  sighting: Sighting | undefined,
  device: DeviceInfo
): IndividualLocation | undefined {
  if (!sighting?.individuals || device.device_latitude == null || device.device_longitude == null) {
    return undefined;
  }
  return sighting.individuals.find((ind) =>
    coordinatesMatch(ind.latitude, ind.longitude, device.device_latitude, device.device_longitude)
  );
}

/**
 * Reorganize species summaries into device-first structure.
 * Backend now returns one summary per (species, device) combination,
 * so we just need to group by device.
 */
function groupByDevice(summaries: SpeciesDetectionSummary[]): DeviceDetections[] {
  const deviceMap = new Map<string, DeviceDetections>();

  for (const summary of summaries) {
    // All clips in a summary are from the same device (backend groups by species+device)
    const firstClip = summary.top_detections[0];
    if (!firstClip) continue;

    const deviceKey = firstClip.device_id || 'unknown';

    if (!deviceMap.has(deviceKey)) {
      deviceMap.set(deviceKey, {
        device: {
          device_id: firstClip.device_id || 'unknown',
          device_name: firstClip.device_name,
          device_latitude: firstClip.device_latitude,
          device_longitude: firstClip.device_longitude,
          location_id: firstClip.location_id,
          location_name: firstClip.location_name,
        },
        species: [],
        total_detections: 0,
      });
    }

    const deviceData = deviceMap.get(deviceKey)!;

    // Add this species summary directly (backend already provides per-device counts)
    deviceData.species.push({
      species_id: summary.species_id,
      species_name: summary.species_name,
      species_scientific_name: summary.species_scientific_name,
      detection_count: summary.detection_count,
      top_detections: summary.top_detections,
    });
    deviceData.total_detections += summary.detection_count;
  }

  // Sort species within each device by max confidence (descending)
  for (const deviceData of deviceMap.values()) {
    deviceData.species.sort((a, b) => {
      const maxA = Math.max(...a.top_detections.map(d => d.confidence));
      const maxB = Math.max(...b.top_detections.map(d => d.confidence));
      return maxB - maxA;
    });
  }

  return Array.from(deviceMap.values());
}

/**
 * DetectionsToSightingsPanel - UI for converting bird detections to sightings
 *
 * Displays detections organized by device in tabs.
 * Click a row to toggle: add as sighting or remove existing sighting.
 *
 * Sighting logic:
 * - Each (species, device) can be confirmed independently
 * - Confirming a species on multiple devices adds multiple individuals to one sighting
 * - Removing removes only the individual for that device
 */
export function DetectionsToSightingsPanel({
  surveyId,
  sightings,
  onSightingsCreated,
  refreshTrigger,
}: DetectionsToSightingsPanelProps) {
  const [summaries, setSummaries] = useState<SpeciesDetectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null); // "speciesId:deviceId"
  const [selectedDeviceIndex, setSelectedDeviceIndex] = useState(0);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<{
    sightingId: number;
    individualId: number;
    speciesName: string;
    isLastIndividual: boolean;
  } | null>(null);

  // Group summaries by device
  const deviceDetections = useMemo(() => groupByDevice(summaries), [summaries]);

  // Create a map of species_id to sighting for quick lookup
  const sightingsBySpeciesId = useMemo(() => {
    const map = new Map<number, Sighting>();
    sightings.forEach((s) => {
      if (!map.has(s.species_id)) {
        map.set(s.species_id, s);
      }
    });
    return map;
  }, [sightings]);

  // Fetch detections summary
  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await audioAPI.getDetectionsSummary(surveyId);
        setSummaries(response.species_summaries);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load detections');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [surveyId, refreshTrigger]);

  // Reset tab selection when device list changes
  useEffect(() => {
    if (selectedDeviceIndex >= deviceDetections.length && deviceDetections.length > 0) {
      setSelectedDeviceIndex(0);
    }
  }, [deviceDetections.length, selectedDeviceIndex]);

  // Get toggling key for a species+device combo
  const getTogglingKey = (speciesId: number, deviceId: string) => `${speciesId}:${deviceId}`;

  // Handle row click - toggle sighting for this (species, device) combination
  const handleRowClick = async (species: DeviceSpeciesSummary, device: DeviceInfo) => {
    const existingSighting = sightingsBySpeciesId.get(species.species_id);
    const existingIndividual = findIndividualAtDeviceGps(existingSighting, device);
    const toggleKey = getTogglingKey(species.species_id, device.device_id);

    if (existingIndividual && existingSighting) {
      // Already has individual at this device GPS - show remove confirmation
      const isLastIndividual = (existingSighting.individuals?.length ?? 0) <= 1;
      setShowRemoveConfirm({
        sightingId: existingSighting.id,
        individualId: existingIndividual.id!,
        speciesName: species.species_name || species.species_scientific_name || 'Unknown',
        isLastIndividual,
      });
    } else if (existingSighting && device.device_latitude != null && device.device_longitude != null) {
      // Sighting exists but no individual at this device GPS - add individual
      setTogglingKey(toggleKey);
      setError(null);

      try {
        await surveysAPI.addIndividualLocation(surveyId, existingSighting.id, {
          latitude: device.device_latitude,
          longitude: device.device_longitude,
          count: 1,
        });
        setSuccessMessage(`Added ${species.species_name || species.species_scientific_name} location`);
        onSightingsCreated?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add location');
      } finally {
        setTogglingKey(null);
      }
    } else {
      // No sighting exists - create new sighting with individual
      setTogglingKey(toggleKey);
      setError(null);

      try {
        const sightingRequest: Parameters<typeof surveysAPI.addSighting>[1] = {
          species_id: species.species_id,
          count: 1,
          location_id: device.location_id ?? undefined,
        };

        // If device has GPS coordinates, add them as an individual location
        if (device.device_latitude != null && device.device_longitude != null) {
          sightingRequest.individuals = [
            {
              latitude: device.device_latitude,
              longitude: device.device_longitude,
              count: 1,
            },
          ];
        }

        await surveysAPI.addSighting(surveyId, sightingRequest);
        setSuccessMessage(`Added ${species.species_name || species.species_scientific_name}`);
        onSightingsCreated?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add sighting');
      } finally {
        setTogglingKey(null);
      }
    }
  };

  // Handle remove confirmation
  const handleConfirmRemove = async () => {
    if (!showRemoveConfirm) return;

    const { sightingId, individualId, speciesName, isLastIndividual } = showRemoveConfirm;
    setShowRemoveConfirm(null);
    setError(null);

    try {
      if (isLastIndividual) {
        // Last individual - delete the entire sighting
        await surveysAPI.deleteSighting(surveyId, sightingId);
        setSuccessMessage(`Removed ${speciesName}`);
      } else {
        // Remove just this individual
        await surveysAPI.deleteIndividualLocation(surveyId, sightingId, individualId);
        setSuccessMessage(`Removed ${speciesName} location`);
      }
      onSightingsCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
    }
  };

  // Loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Empty state
  if (summaries.length === 0 || deviceDetections.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">
          No bird detections found. Upload and process audio files to see detections.
        </Typography>
      </Box>
    );
  }

  const selectedDevice = deviceDetections[selectedDeviceIndex];

  return (
    <Box>
      {/* Error Alert */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Success Alert */}
      {successMessage && (
        <Alert severity="success" onClose={() => setSuccessMessage(null)} sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}

      {/* Device Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={selectedDeviceIndex}
          onChange={(_, newValue) => setSelectedDeviceIndex(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              minHeight: 48,
              py: 1,
            },
          }}
        >
          {deviceDetections.map((deviceData, index) => (
            <Tab
              key={deviceData.device.device_id}
              label={
                <Stack direction="row" alignItems="center" spacing={1}>
                  <MicNone sx={{ fontSize: 18 }} />
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2 }}>
                      {deviceData.device.device_name || deviceData.device.device_id}
                    </Typography>
                    {deviceData.device.location_name && (
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                        {deviceData.device.location_name}
                      </Typography>
                    )}
                  </Box>
                  <Chip
                    label={deviceData.species.length}
                    size="small"
                    sx={{
                      height: 20,
                      minWidth: 24,
                      bgcolor: selectedDeviceIndex === index ? 'primary.main' : 'grey.300',
                      color: selectedDeviceIndex === index ? 'white' : 'text.primary',
                      fontWeight: 600,
                      '& .MuiChip-label': { px: 0.75, fontSize: '0.75rem' },
                    }}
                  />
                </Stack>
              }
            />
          ))}
        </Tabs>
      </Box>

      {/* Table for selected device */}
      {selectedDevice && (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
          {/* Table Header */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '40px 2fr 80px 1.5fr',
              gap: 2,
              p: 1.5,
              bgcolor: 'grey.50',
              borderBottom: '1px solid',
              borderColor: 'divider',
              alignItems: 'center',
            }}
          >
            <Box /> {/* Icon column header - empty */}
            <Typography variant="body2" fontWeight={600} color="text.secondary">
              SPECIES
            </Typography>
            <Typography variant="body2" fontWeight={600} color="text.secondary" textAlign="center">
              COUNT
            </Typography>
            <Typography variant="body2" fontWeight={600} color="text.secondary">
              TOP DETECTIONS
            </Typography>
          </Box>

          {/* Table Rows */}
          {selectedDevice.species.map((species) => {
            const existingSighting = sightingsBySpeciesId.get(species.species_id);
            const existingIndividual = findIndividualAtDeviceGps(existingSighting, selectedDevice.device);
            const isAddedForThisDevice = !!existingIndividual;
            const toggleKey = getTogglingKey(species.species_id, selectedDevice.device.device_id);
            const isToggling = togglingKey === toggleKey;

            return (
              <Box
                key={species.species_id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '40px 2fr 80px 1.5fr',
                  gap: 2,
                  p: 1.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  alignItems: 'center',
                  '&:last-child': { borderBottom: 'none' },
                  borderLeft: isAddedForThisDevice ? `3px solid ${notionColors.green.text}` : '3px solid transparent',
                  '&:hover': {
                    bgcolor: 'grey.50',
                  },
                  cursor: isToggling ? 'wait' : 'pointer',
                  opacity: isToggling ? 0.6 : 1,
                  transition: 'all 0.15s ease-in-out',
                }}
                onClick={() => !isToggling && handleRowClick(species, selectedDevice.device)}
              >
                {/* Toggle Icon */}
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  {isToggling ? (
                    <CircularProgress size={20} />
                  ) : isAddedForThisDevice ? (
                    <CheckCircle
                      sx={{
                        fontSize: 22,
                        color: notionColors.green.text,
                      }}
                    />
                  ) : (
                    <AddCircleOutline
                      sx={{
                        fontSize: 22,
                        color: 'text.disabled',
                        '&:hover': { color: 'text.secondary' },
                      }}
                    />
                  )}
                </Box>

                {/* Species Name */}
                <Box>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                    {species.species_name || <i>{species.species_scientific_name}</i>}
                  </Typography>
                  {species.species_name && species.species_scientific_name && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {species.species_scientific_name}
                    </Typography>
                  )}
                </Box>

                {/* Detection Count */}
                <Typography
                  variant="body2"
                  fontWeight={600}
                  textAlign="center"
                  sx={{ fontSize: '0.875rem' }}
                >
                  {species.detection_count}
                </Typography>

                {/* Audio Clips */}
                <Stack
                  direction="row"
                  spacing={1}
                  onClick={(e) => e.stopPropagation()}
                >
                  {species.top_detections.map((clip, index) => (
                    <AudioClipPlayer
                      key={index}
                      audioRecordingId={clip.audio_recording_id}
                      startTime={clip.start_time}
                      endTime={clip.end_time}
                      confidence={clip.confidence}
                    />
                  ))}
                </Stack>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Remove Confirmation Dialog */}
      <Dialog
        open={!!showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Remove Sighting</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Remove <strong>{showRemoveConfirm?.speciesName}</strong> from this device?
            {showRemoveConfirm?.isLastIndividual && (
              <Box component="span" sx={{ display: 'block', mt: 1, color: 'warning.main' }}>
                This is the only location for this species and will remove the sighting entirely.
              </Box>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setShowRemoveConfirm(null)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmRemove}
            variant="contained"
            color="error"
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
            }}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
