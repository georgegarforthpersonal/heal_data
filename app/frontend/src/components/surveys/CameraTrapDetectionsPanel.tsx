import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Stack,
  Tabs,
  Tab,
  Chip,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Radio,
  FormControlLabel,
  RadioGroup,
} from '@mui/material';
import { AddCircleOutline, CheckCircle, PhotoCamera, ZoomIn, Close } from '@mui/icons-material';
import { imagesAPI, surveysAPI } from '../../services/api';
import type { ImageWithDetections, ImageDetectionOption, Sighting, IndividualLocation } from '../../services/api';
import { notionColors } from '../../theme';

interface CameraTrapDetectionsPanelProps {
  surveyId: number;
  sightings: Sighting[];
  onSightingsCreated?: () => void;
  refreshTrigger?: number;
}

interface DeviceInfo {
  device_id: string;
  device_name: string | null;
  device_latitude: number | null;
  device_longitude: number | null;
  location_id: number | null;
  location_name: string | null;
}

interface DeviceImages {
  device: DeviceInfo;
  images: ImageWithDetections[];
}

function findIndividualByImageId(
  sighting: Sighting | undefined,
  imageId: number
): IndividualLocation | undefined {
  if (!sighting?.individuals) {
    return undefined;
  }
  return sighting.individuals.find((ind) => ind.camera_trap_image_id === imageId);
}

function groupByDevice(images: ImageWithDetections[]): DeviceImages[] {
  const deviceMap = new Map<string, DeviceImages>();

  for (const image of images) {
    const deviceKey = image.device_id || 'unknown';

    if (!deviceMap.has(deviceKey)) {
      deviceMap.set(deviceKey, {
        device: {
          device_id: image.device_id || 'unknown',
          device_name: image.device_name,
          device_latitude: image.device_latitude,
          device_longitude: image.device_longitude,
          location_id: image.location_id,
          location_name: image.location_name,
        },
        images: [],
      });
    }

    deviceMap.get(deviceKey)!.images.push(image);
  }

  return Array.from(deviceMap.values());
}

function ImageThumbnail({
  imageId,
  onPreview,
}: {
  imageId: number;
  onPreview: (url: string) => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    imagesAPI.getPreviewUrl(imageId)
      .then((response) => {
        if (mounted) {
          setImageUrl(response.preview_url);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setError(true);
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, [imageId]);

  if (loading) {
    return (
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: 1,
          bgcolor: 'grey.100',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <CircularProgress size={16} />
      </Box>
    );
  }

  if (error || !imageUrl) {
    return (
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: 1,
          bgcolor: 'grey.200',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <PhotoCamera sx={{ fontSize: 20, color: 'text.disabled' }} />
      </Box>
    );
  }

  return (
    <Tooltip title="Click to enlarge">
      <Box
        sx={{
          position: 'relative',
          width: 80,
          height: 80,
          borderRadius: 1,
          overflow: 'hidden',
          cursor: 'pointer',
          flexShrink: 0,
          '&:hover': {
            '& .zoom-overlay': {
              opacity: 1,
            },
          },
        }}
        onClick={(e) => {
          e.stopPropagation();
          onPreview(imageUrl);
        }}
      >
        <img
          src={imageUrl}
          alt="Detection"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <Box
          className="zoom-overlay"
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 0.2s',
          }}
        >
          <ZoomIn sx={{ color: 'white', fontSize: 24 }} />
        </Box>
      </Box>
    </Tooltip>
  );
}

function SpeciesRadioLabel({
  detection,
  added,
}: {
  detection: ImageDetectionOption;
  added: boolean;
}) {
  const displayName = detection.species_name || detection.scientific_name;
  const confidencePercent = (detection.confidence * 100).toFixed(2);

  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      {added && <CheckCircle sx={{ fontSize: 16, color: notionColors.green.text }} />}
      <Typography variant="body2">{displayName}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
        {confidencePercent}%
      </Typography>
    </Stack>
  );
}

/** Panel for converting camera trap image detections to sightings */
export function CameraTrapDetectionsPanel({
  surveyId,
  sightings,
  onSightingsCreated,
  refreshTrigger,
}: CameraTrapDetectionsPanelProps) {
  const [images, setImages] = useState<ImageWithDetections[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedDeviceIndex, setSelectedDeviceIndex] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [selectedSpecies, setSelectedSpecies] = useState<Record<number, string>>({});
  const [processingImages, setProcessingImages] = useState<Set<number>>(new Set());
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<{
    sightingId: number;
    individualId: number;
    speciesName: string;
    isLastIndividual: boolean;
  } | null>(null);

  const deviceImages = useMemo(() => groupByDevice(images), [images]);

  const sightingsBySpeciesId = useMemo(() => {
    const map = new Map<number, Sighting>();
    sightings.forEach((s) => {
      if (!map.has(s.species_id)) {
        map.set(s.species_id, s);
      }
    });
    return map;
  }, [sightings]);

  useEffect(() => {
    const initial: Record<number, string> = {};
    for (const image of images) {
      if (image.detections.length > 0) {
        const firstDetection = image.detections[0];
        initial[image.image_id] = getDetectionKey(firstDetection);
      }
    }
    setSelectedSpecies(initial);
  }, [images]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await imagesAPI.getDetectionsSummary(surveyId);
        setImages(response.images);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load detections');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [surveyId, refreshTrigger]);

  useEffect(() => {
    if (selectedDeviceIndex >= deviceImages.length && deviceImages.length > 0) {
      setSelectedDeviceIndex(0);
    }
  }, [deviceImages.length, selectedDeviceIndex]);

  const getDetectionKey = (detection: ImageDetectionOption) =>
    detection.species_id?.toString() || detection.scientific_name;

  const selectSpecies = (imageId: number, detection: ImageDetectionOption) => {
    setSelectedSpecies(prev => ({ ...prev, [imageId]: getDetectionKey(detection) }));
  };

  const isAddedForImage = (detection: ImageDetectionOption, imageId: number) => {
    if (!detection.species_id) return false;
    const sighting = sightingsBySpeciesId.get(detection.species_id);
    return !!findIndividualByImageId(sighting, imageId);
  };

  const getSelectedDetection = (image: ImageWithDetections): ImageDetectionOption | null => {
    const selectedKey = selectedSpecies[image.image_id];
    if (!selectedKey) return null;
    return image.detections.find(d => getDetectionKey(d) === selectedKey) || null;
  };

  const handleAdd = async (image: ImageWithDetections, device: DeviceInfo) => {
    const detection = getSelectedDetection(image);
    if (!detection || !detection.species_id) return;

    const existingSighting = sightingsBySpeciesId.get(detection.species_id);
    if (findIndividualByImageId(existingSighting, image.image_id)) return;

    setProcessingImages(prev => new Set(prev).add(image.image_id));
    setError(null);

    try {
      if (existingSighting && device.device_latitude != null && device.device_longitude != null) {
        await surveysAPI.addIndividualLocation(surveyId, existingSighting.id, {
          latitude: device.device_latitude,
          longitude: device.device_longitude,
          count: 1,
          camera_trap_image_id: image.image_id,
        });
        setSuccessMessage(`Added ${detection.species_name || detection.scientific_name} location`);
      } else {
        const sightingRequest: Parameters<typeof surveysAPI.addSighting>[1] = {
          species_id: detection.species_id,
          count: 1,
          location_id: device.location_id ?? undefined,
        };

        if (device.device_latitude != null && device.device_longitude != null) {
          sightingRequest.individuals = [
            {
              latitude: device.device_latitude,
              longitude: device.device_longitude,
              count: 1,
              camera_trap_image_id: image.image_id,
            },
          ];
        }

        await surveysAPI.addSighting(surveyId, sightingRequest);
        setSuccessMessage(`Added ${detection.species_name || detection.scientific_name}`);
      }
      onSightingsCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add sighting');
    } finally {
      setProcessingImages(prev => {
        const updated = new Set(prev);
        updated.delete(image.image_id);
        return updated;
      });
    }
  };

  const handleRemoveClick = (image: ImageWithDetections) => {
    const detection = getSelectedDetection(image);
    if (!detection || !detection.species_id) return;

    const sighting = sightingsBySpeciesId.get(detection.species_id);
    const individual = findIndividualByImageId(sighting, image.image_id);

    if (!sighting || !individual) return;

    const isLastIndividual = (sighting.individuals?.length ?? 0) <= 1;
    setShowRemoveConfirm({
      sightingId: sighting.id,
      individualId: individual.id!,
      speciesName: detection.species_name || detection.scientific_name,
      isLastIndividual,
    });
  };

  const handleConfirmRemove = async () => {
    if (!showRemoveConfirm) return;

    const { sightingId, individualId, speciesName, isLastIndividual } = showRemoveConfirm;
    setShowRemoveConfirm(null);
    setError(null);

    try {
      if (isLastIndividual) {
        await surveysAPI.deleteSighting(surveyId, sightingId);
        setSuccessMessage(`Removed ${speciesName}`);
      } else {
        await surveysAPI.deleteIndividualLocation(surveyId, sightingId, individualId);
        setSuccessMessage(`Removed ${speciesName} location`);
      }
      onSightingsCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (images.length === 0 || deviceImages.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">
          No species detections found. Upload and process camera trap images to see detections.
        </Typography>
      </Box>
    );
  }

  const selectedDevice = deviceImages[selectedDeviceIndex];

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
          {deviceImages.map((deviceData, index) => (
            <Tab
              key={deviceData.device.device_id}
              label={
                <Stack direction="row" alignItems="center" spacing={1}>
                  <PhotoCamera sx={{ fontSize: 18 }} />
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
                    label={deviceData.images.length}
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

      {/* Image Rows for selected device */}
      {selectedDevice && (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
          {/* Table Header */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '40px 90px 1fr',
              gap: 2,
              p: 1.5,
              bgcolor: 'grey.50',
              borderBottom: '1px solid',
              borderColor: 'divider',
              alignItems: 'center',
            }}
          >
            <Box /> {/* Add button column */}
            <Typography variant="body2" fontWeight={600} color="text.secondary">
              IMAGE
            </Typography>
            <Typography variant="body2" fontWeight={600} color="text.secondary">
              SPECIES
            </Typography>
          </Box>

          {/* Image Rows */}
          {selectedDevice.images.map((image) => {
            const isProcessing = processingImages.has(image.image_id);
            const selectedDetection = getSelectedDetection(image);
            const isAdded = selectedDetection ? isAddedForImage(selectedDetection, image.image_id) : false;
            const hasSelection = !!selectedDetection;

            return (
              <Box
                key={image.image_id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '40px 90px 1fr',
                  gap: 2,
                  p: 1.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  alignItems: 'center',
                  '&:last-child': { borderBottom: 'none' },
                  '&:hover': { bgcolor: 'grey.50' },
                  borderLeft: isAdded ? `3px solid ${notionColors.green.text}` : '3px solid transparent',
                }}
              >
                {/* Add/Remove Button */}
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  {isProcessing ? (
                    <CircularProgress size={22} />
                  ) : isAdded ? (
                    <Tooltip title="Remove sighting">
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveClick(image)}
                        sx={{
                          color: notionColors.green.text,
                          '&:hover': { color: 'error.main' },
                        }}
                      >
                        <CheckCircle sx={{ fontSize: 22 }} />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title={hasSelection ? 'Add as sighting' : 'Select a species first'}>
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => handleAdd(image, selectedDevice.device)}
                          disabled={!hasSelection || !selectedDetection?.species_id}
                          sx={{
                            color: hasSelection ? 'primary.main' : 'text.disabled',
                            '&:hover': { color: 'primary.dark' },
                          }}
                        >
                          <AddCircleOutline sx={{ fontSize: 22 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </Box>

                {/* Image Thumbnail */}
                <ImageThumbnail
                  imageId={image.image_id}
                  onPreview={setPreviewImage}
                />

                {/* Species Options */}
                <RadioGroup
                  value={selectedSpecies[image.image_id] || ''}
                  onChange={(e) => {
                    const detection = image.detections.find(d => getDetectionKey(d) === e.target.value);
                    if (detection) selectSpecies(image.image_id, detection);
                  }}
                >
                  {image.detections.map((detection, idx) => (
                    <FormControlLabel
                      key={idx}
                      value={getDetectionKey(detection)}
                      control={<Radio size="small" />}
                      label={
                        <SpeciesRadioLabel
                          detection={detection}
                          added={isAddedForImage(detection, image.image_id)}
                        />
                      }
                      sx={{
                        m: 0,
                        py: 0.25,
                        '& .MuiFormControlLabel-label': { ml: 0.5 },
                      }}
                    />
                  ))}
                </RadioGroup>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Image Preview Dialog */}
      <Dialog
        open={!!previewImage}
        onClose={() => setPreviewImage(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Image Preview
          <IconButton onClick={() => setPreviewImage(null)} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, display: 'flex', justifyContent: 'center', bgcolor: 'black' }}>
          {previewImage && (
            <img
              src={previewImage}
              alt="Full size preview"
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain',
              }}
            />
          )}
        </DialogContent>
      </Dialog>

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
