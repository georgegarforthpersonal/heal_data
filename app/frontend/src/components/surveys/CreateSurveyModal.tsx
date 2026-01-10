import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Stack,
  Chip
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import { surveysAPI } from '../../services/api';
import type { Survey, Location, Surveyor } from '../../services/api';

/**
 * CreateSurveyModal - Modal dialog for creating new surveys
 *
 * Features:
 * - Simple form with essential survey fields
 * - Required fields: date, location, at least one surveyor
 * - Optional fields: notes
 * - Real-time validation
 * - API integration with error handling
 * - Success callback to navigate to detail page
 *
 * Following DEVELOPMENT.md conventions:
 * - Built inline first (no form library initially)
 * - Uses MUI components with theme integration
 * - Simple state management
 */

interface CreateSurveyModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (survey: Survey) => void;
  locations: Location[];
  surveyors: Surveyor[];
}

export function CreateSurveyModal({
  open,
  onClose,
  onSuccess,
  locations,
  surveyors
}: CreateSurveyModalProps) {

  // ============================================================================
  // Form State
  // ============================================================================

  const [date, setDate] = useState<Dayjs | null>(dayjs());
  const [locationId, setLocationId] = useState<number | null>(null);
  const [selectedSurveyors, setSelectedSurveyors] = useState<Surveyor[]>([]);
  const [notes, setNotes] = useState<string>('');

  // ============================================================================
  // UI State
  // ============================================================================

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    date?: string;
    location?: string;
    surveyors?: string;
  }>({});

  // ============================================================================
  // Validation
  // ============================================================================

  const validate = (): boolean => {
    const errors: typeof validationErrors = {};

    if (!date) {
      errors.date = 'Date is required';
    }

    if (!locationId) {
      errors.location = 'Location is required';
    }

    if (selectedSurveyors.length === 0) {
      errors.surveyors = 'At least one surveyor is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ============================================================================
  // Form Submission
  // ============================================================================

  const handleSubmit = async () => {
    // Validate form
    if (!validate()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build survey payload
      const surveyData: Partial<Survey> = {
        date: date!.format('YYYY-MM-DD'),
        location_id: locationId!,
        surveyor_ids: selectedSurveyors.map(s => s.id),
        type: 'butterfly', // Default type
        notes: notes.trim() || null,
      };

      // Create survey via API
      const newSurvey = await surveysAPI.create(surveyData);

      // Success - call callback
      onSuccess(newSurvey);

      // Reset form
      resetForm();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create survey');
      console.error('Error creating survey:', err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // Form Reset
  // ============================================================================

  const resetForm = () => {
    setDate(dayjs());
    setLocationId(null);
    setSelectedSurveyors([]);
    setNotes('');
    setValidationErrors({});
    setError(null);
  };

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  const handleCancel = () => {
    handleClose();
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
            Create New Survey
          </Typography>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={3} sx={{ py: 1 }}>

            {/* Error Alert */}
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* ================================================================ */}
            {/* BASIC INFORMATION */}
            {/* ================================================================ */}

            <Box>
              <Typography
                variant="overline"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 600,
                  letterSpacing: '0.5px'
                }}
              >
                Basic Information
              </Typography>

              <Stack spacing={2} sx={{ mt: 1.5 }}>
                {/* Date Picker */}
                <DatePicker
                  label="Date *"
                  value={date}
                  onChange={(newValue) => setDate(newValue)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!validationErrors.date,
                      helperText: validationErrors.date,
                    }
                  }}
                />

                {/* Location Dropdown */}
                <Autocomplete
                  options={locations}
                  getOptionLabel={(option) => option.name}
                  value={locations.find(l => l.id === locationId) || null}
                  onChange={(_, newValue) => setLocationId(newValue?.id || null)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Location *"
                      error={!!validationErrors.location}
                      helperText={validationErrors.location}
                    />
                  )}
                />

                {/* Surveyors Multi-Select */}
                <Autocomplete
                  multiple
                  options={surveyors}
                  getOptionLabel={(option) => option.last_name ? `${option.first_name} ${option.last_name}` : option.first_name}
                  value={selectedSurveyors}
                  onChange={(_, newValue) => setSelectedSurveyors(newValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Surveyors *"
                      error={!!validationErrors.surveyors}
                      helperText={validationErrors.surveyors || 'Select at least one surveyor'}
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        label={option.last_name ? `${option.first_name} ${option.last_name}` : option.first_name}
                        {...getTagProps({ index })}
                        size="small"
                      />
                    ))
                  }
                />
              </Stack>
            </Box>

            {/* ================================================================ */}
            {/* NOTES (Optional) */}
            {/* ================================================================ */}

            <Box>
              <Typography
                variant="overline"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 600,
                  letterSpacing: '0.5px'
                }}
              >
                Notes (Optional)
              </Typography>

              <TextField
                multiline
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes about this survey..."
                fullWidth
                sx={{ mt: 1.5 }}
              />
            </Box>

          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={handleCancel}
            disabled={loading}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading || !date || !locationId || selectedSurveyors.length === 0}
            sx={{
              textTransform: 'none',
              minWidth: 120
            }}
          >
            {loading ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Creating...
              </>
            ) : (
              'Create Survey'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
}
