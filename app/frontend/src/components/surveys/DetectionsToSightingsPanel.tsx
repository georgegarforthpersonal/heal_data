import { useState, useEffect } from 'react';
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
} from '@mui/material';
import { AddCircleOutline, CheckCircle, LocationOn } from '@mui/icons-material';
import { audioAPI, surveysAPI } from '../../services/api';
import type { SpeciesDetectionSummary, Sighting } from '../../services/api';
import { AudioClipPlayer } from '../audio/AudioClipPlayer';
import { notionColors } from '../../theme';

interface DetectionsToSightingsPanelProps {
  surveyId: number;
  sightings: Sighting[]; // Existing sightings to show which species have been converted
  onSightingsCreated?: () => void;
  refreshTrigger?: number; // Increment to trigger a refresh
}

/**
 * DetectionsToSightingsPanel - UI for converting bird detections to sightings
 *
 * Displays a list of detected species with audio clips.
 * Click a row to toggle: add as sighting or remove existing sighting.
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
  const [togglingSpeciesId, setTogglingSpeciesId] = useState<number | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<{
    sightingId: number;
    speciesId: number;
    speciesName: string;
  } | null>(null);

  // Create a map of species_id to sighting for quick lookup
  const sightingsBySpeciesId = new Map<number, Sighting>();
  sightings.forEach((s) => {
    if (!sightingsBySpeciesId.has(s.species_id)) {
      sightingsBySpeciesId.set(s.species_id, s);
    }
  });

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

  // Handle row click - toggle sighting
  const handleRowClick = async (summary: SpeciesDetectionSummary) => {
    const existingSighting = sightingsBySpeciesId.get(summary.species_id);

    if (existingSighting) {
      // Already added - show remove confirmation
      setShowRemoveConfirm({
        sightingId: existingSighting.id,
        speciesId: summary.species_id,
        speciesName: summary.species_name || summary.species_scientific_name || 'Unknown',
      });
    } else {
      // Not added - create sighting immediately
      setTogglingSpeciesId(summary.species_id);
      setError(null);

      try {
        // Use location from the top detection (highest confidence) if available
        const topDetection = summary.top_detections[0];
        const locationId = topDetection?.location_id ?? undefined;

        await surveysAPI.addSighting(surveyId, {
          species_id: summary.species_id,
          count: 1,
          location_id: locationId,
        });
        setSuccessMessage(`Added ${summary.species_name || summary.species_scientific_name}`);
        onSightingsCreated?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add sighting');
      } finally {
        setTogglingSpeciesId(null);
      }
    }
  };

  // Handle remove confirmation
  const handleConfirmRemove = async () => {
    if (!showRemoveConfirm) return;

    setTogglingSpeciesId(showRemoveConfirm.speciesId);
    setShowRemoveConfirm(null);
    setError(null);

    try {
      await surveysAPI.deleteSighting(surveyId, showRemoveConfirm.sightingId);
      setSuccessMessage(`Removed ${showRemoveConfirm.speciesName}`);
      onSightingsCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove sighting');
    } finally {
      setTogglingSpeciesId(null);
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
  if (summaries.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">
          No bird detections found. Upload and process audio files to see detections.
        </Typography>
      </Box>
    );
  }

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

      {/* Table */}
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
        {summaries.map((summary) => {
          const existingSighting = sightingsBySpeciesId.get(summary.species_id);
          const isAdded = !!existingSighting;
          const isToggling = togglingSpeciesId === summary.species_id;

          return (
            <Box
              key={summary.species_id}
              sx={{
                display: 'grid',
                gridTemplateColumns: '40px 2fr 80px 1.5fr',
                gap: 2,
                p: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                alignItems: 'center',
                '&:last-child': { borderBottom: 'none' },
                // Subtle left border for added items
                borderLeft: isAdded ? `3px solid ${notionColors.green.text}` : '3px solid transparent',
                '&:hover': {
                  bgcolor: 'grey.50',
                },
                cursor: isToggling ? 'wait' : 'pointer',
                opacity: isToggling ? 0.6 : 1,
                transition: 'all 0.15s ease-in-out',
              }}
              onClick={() => !isToggling && handleRowClick(summary)}
            >
              {/* Toggle Icon */}
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                {isToggling ? (
                  <CircularProgress size={20} />
                ) : isAdded ? (
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
                  {summary.species_name || <i>{summary.species_scientific_name}</i>}
                </Typography>
                {summary.species_name && summary.species_scientific_name && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    {summary.species_scientific_name}
                  </Typography>
                )}
                {/* Show location from top detection if available */}
                {summary.top_detections[0]?.location_name && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                    <LocationOn sx={{ fontSize: 12, color: 'text.disabled' }} />
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                      {summary.top_detections[0].location_name}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Detection Count */}
              <Typography
                variant="body2"
                fontWeight={600}
                textAlign="center"
                sx={{ fontSize: '0.875rem' }}
              >
                {summary.detection_count}
              </Typography>

              {/* Audio Clips */}
              <Stack
                direction="row"
                spacing={1}
                onClick={(e) => e.stopPropagation()}
              >
                {summary.top_detections.map((clip, index) => (
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
            Remove <strong>{showRemoveConfirm?.speciesName}</strong> from sightings?
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
