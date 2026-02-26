import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Checkbox,
  Button,
  CircularProgress,
  Alert,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
  Tooltip,
} from '@mui/material';
import { AddCircle, Delete } from '@mui/icons-material';
import { audioAPI, surveysAPI } from '../../services/api';
import type { SpeciesDetectionSummary, Sighting } from '../../services/api';
import { AudioClipPlayer } from '../audio/AudioClipPlayer';

interface DetectionsToSightingsPanelProps {
  surveyId: number;
  sightings: Sighting[]; // Existing sightings to show which species have been converted
  onSightingsCreated?: () => void;
  refreshTrigger?: number; // Increment to trigger a refresh
}

/**
 * DetectionsToSightingsPanel - Main UI for converting bird detections to sightings
 *
 * Displays a table of species with detection counts and audio clips.
 * Users can select species and convert them to sighting records.
 */
export function DetectionsToSightingsPanel({
  surveyId,
  sightings,
  onSightingsCreated,
  refreshTrigger,
}: DetectionsToSightingsPanelProps) {
  const [summaries, setSummaries] = useState<SpeciesDetectionSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deletingSightingId, setDeletingSightingId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ sightingId: number; speciesName: string } | null>(null);

  // Create a map of species_id to sighting for quick lookup
  const sightingsBySpeciesId = new Map<number, Sighting>();
  sightings.forEach((s) => {
    // If multiple sightings exist for the same species, keep the first one
    if (!sightingsBySpeciesId.has(s.species_id)) {
      sightingsBySpeciesId.set(s.species_id, s);
    }
  });

  // Get species IDs that have not been converted yet (for select all logic)
  const unconvertedSummaries = summaries.filter((s) => !sightingsBySpeciesId.has(s.species_id));

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

  // Handle checkbox toggle for a single species
  const handleToggle = (speciesId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(speciesId)) {
        next.delete(speciesId);
      } else {
        next.add(speciesId);
      }
      return next;
    });
  };

  // Handle select all (only for unconverted species)
  const handleSelectAll = () => {
    if (selectedIds.size === unconvertedSummaries.length && unconvertedSummaries.length > 0) {
      // Deselect all
      setSelectedIds(new Set());
    } else {
      // Select all unconverted
      setSelectedIds(new Set(unconvertedSummaries.map((s) => s.species_id)));
    }
  };

  // Handle delete sighting
  const handleDeleteClick = (sightingId: number, speciesName: string) => {
    setShowDeleteConfirm({ sightingId, speciesName });
  };

  const handleConfirmDelete = async () => {
    if (!showDeleteConfirm) return;

    setDeletingSightingId(showDeleteConfirm.sightingId);
    setShowDeleteConfirm(null);
    setError(null);

    try {
      await surveysAPI.deleteSighting(surveyId, showDeleteConfirm.sightingId);
      setSuccessMessage('Sighting removed');
      onSightingsCreated?.(); // Refresh sightings list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete sighting');
    } finally {
      setDeletingSightingId(null);
    }
  };

  // Get selected species for confirmation dialog
  const getSelectedSpecies = (): SpeciesDetectionSummary[] => {
    return summaries.filter((s) => selectedIds.has(s.species_id));
  };

  // Handle convert button click
  const handleConvertClick = () => {
    setShowConfirmDialog(true);
  };

  // Handle confirmation
  const handleConfirmConvert = async () => {
    setShowConfirmDialog(false);
    setConverting(true);
    setError(null);
    setSuccessMessage(null);

    const selected = getSelectedSpecies();

    try {
      // Create sightings for each selected species
      for (const species of selected) {
        await surveysAPI.addSighting(surveyId, {
          species_id: species.species_id,
          count: 1,
        });
      }

      setSuccessMessage(`Created ${selected.length} sighting${selected.length > 1 ? 's' : ''}`);
      setSelectedIds(new Set());

      // Notify parent to refresh sightings
      onSightingsCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sightings');
    } finally {
      setConverting(false);
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

  const isAllSelected = unconvertedSummaries.length > 0 && selectedIds.size === unconvertedSummaries.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < unconvertedSummaries.length;

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
            gridTemplateColumns: '48px 2fr 80px 1.5fr',
            gap: 2,
            p: 1.5,
            bgcolor: 'grey.50',
            borderBottom: '1px solid',
            borderColor: 'divider',
            alignItems: 'center',
          }}
        >
          <Checkbox
            checked={isAllSelected}
            indeterminate={isSomeSelected}
            onChange={handleSelectAll}
            disabled={unconvertedSummaries.length === 0}
            size="small"
          />
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
          const isConverted = !!existingSighting;
          const isDeleting = deletingSightingId === existingSighting?.id;

          return (
            <Box
              key={summary.species_id}
              sx={{
                display: 'grid',
                gridTemplateColumns: '48px 2fr 80px 1.5fr',
                gap: 2,
                p: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                alignItems: 'center',
                '&:last-child': { borderBottom: 'none' },
                bgcolor: isConverted ? 'success.light' : 'transparent',
                '&:hover': { bgcolor: isConverted ? 'success.light' : 'grey.50' },
                cursor: isConverted ? 'default' : 'pointer',
                opacity: isDeleting ? 0.5 : 1,
              }}
              onClick={() => !isConverted && handleToggle(summary.species_id)}
            >
              {/* Checkbox or Delete Button */}
              {isConverted ? (
                <Tooltip title="Remove sighting">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(
                        existingSighting.id,
                        summary.species_name || summary.species_scientific_name || 'Unknown'
                      );
                    }}
                    disabled={isDeleting}
                    sx={{
                      color: 'text.secondary',
                      '&:hover': { color: 'error.main', bgcolor: 'error.light' },
                    }}
                  >
                    {isDeleting ? <CircularProgress size={20} /> : <Delete fontSize="small" />}
                  </IconButton>
                </Tooltip>
              ) : (
                <Checkbox
                  checked={selectedIds.has(summary.species_id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => handleToggle(summary.species_id)}
                  size="small"
                />
              )}

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

      {/* Convert Button */}
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={converting ? <CircularProgress size={20} color="inherit" /> : <AddCircle />}
          disabled={selectedIds.size === 0 || converting}
          onClick={handleConvertClick}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          }}
        >
          {converting
            ? 'Creating...'
            : `Convert to Sighting${selectedIds.size !== 1 ? 's' : ''} (${selectedIds.size})`}
        </Button>
      </Box>

      {/* Confirmation Dialog */}
      <Dialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Conversion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Create sightings for the following {selectedIds.size} species? Each will be recorded
            with a count of 1.
          </DialogContentText>
          <Box sx={{ mt: 2 }}>
            {getSelectedSpecies().map((species) => (
              <Typography key={species.species_id} variant="body2" sx={{ py: 0.5 }}>
                {species.species_name || species.species_scientific_name}
                {' '}
                <Typography component="span" color="text.secondary">
                  ({species.detection_count} detection{species.detection_count !== 1 ? 's' : ''})
                </Typography>
              </Typography>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setShowConfirmDialog(false)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmConvert}
            variant="contained"
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
            }}
          >
            Create Sightings
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Remove Sighting</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Remove the sighting for <strong>{showDeleteConfirm?.speciesName}</strong>? This will
            allow you to select this species again from the detections list.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setShowDeleteConfirm(null)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
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
