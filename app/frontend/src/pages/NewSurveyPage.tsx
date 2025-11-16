import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  TextField,
  Autocomplete,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
  Breadcrumbs,
  Link
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { ArrowBack, Delete, Save, Cancel } from '@mui/icons-material';
import { surveysAPI, surveyorsAPI, locationsAPI, speciesAPI } from '../services/api';
import type { Survey, Location, Surveyor, Species } from '../services/api';

/**
 * NewSurveyPage - Full-page form for creating surveys with inline sightings
 *
 * Features:
 * - Complete survey creation in one place
 * - Inline sightings editor (add multiple sightings before saving)
 * - Single transaction saves survey + all sightings
 * - No modal → page transition required
 *
 * Following DEVELOPMENT.md conventions:
 * - Built inline first
 * - Uses MUI components with theme integration
 * - Simple state management
 */

interface DraftSighting {
  tempId: string; // Temporary ID for draft sightings (before save)
  species_id: number | null;
  count: number;
}

export function NewSurveyPage() {
  const navigate = useNavigate();

  // ============================================================================
  // Form State - Survey Fields
  // ============================================================================

  const [date, setDate] = useState<Dayjs | null>(dayjs());
  const [locationId, setLocationId] = useState<number | null>(null);
  const [selectedSurveyors, setSelectedSurveyors] = useState<Surveyor[]>([]);
  const [surveyorsOpen, setSurveyorsOpen] = useState(false);
  const [notes, setNotes] = useState<string>('');

  // ============================================================================
  // Form State - Sightings
  // ============================================================================

  const [draftSightings, setDraftSightings] = useState<DraftSighting[]>([
    // Start with one empty sighting row
    {
      tempId: `temp-${Date.now()}`,
      species_id: null,
      count: 1,
    },
  ]);

  // ============================================================================
  // Data State
  // ============================================================================

  const [locations, setLocations] = useState<Location[]>([]);
  const [surveyors, setSurveyors] = useState<Surveyor[]>([]);
  const [species, setSpecies] = useState<Species[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // Validation State
  // ============================================================================

  const [validationErrors, setValidationErrors] = useState<{
    date?: string;
    location?: string;
    surveyors?: string;
    sightings?: string;
  }>({});

  // ============================================================================
  // Data Fetching
  // ============================================================================

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all necessary data in parallel
        const [locationsData, surveyorsData, speciesData] = await Promise.all([
          locationsAPI.getAll(),
          surveyorsAPI.getAll(),
          speciesAPI.getAll(),
        ]);

        setLocations(locationsData);
        setSurveyors(surveyorsData);
        setSpecies(speciesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load form data');
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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

    // Check for at least one valid sighting
    const validSightings = draftSightings.filter(
      (s) => s.species_id !== null && s.count > 0
    );
    if (validSightings.length === 0) {
      errors.sightings = 'At least one sighting is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ============================================================================
  // Sightings Management
  // ============================================================================

  const addSightingRow = () => {
    setDraftSightings([
      ...draftSightings,
      {
        tempId: `temp-${Date.now()}`,
        species_id: null,
        count: 1,
      },
    ]);

    // Clear sightings validation error when user adds a row
    if (validationErrors.sightings) {
      setValidationErrors({ ...validationErrors, sightings: undefined });
    }
  };

  const removeSightingRow = (tempId: string) => {
    // Always keep at least one row
    if (draftSightings.length > 1) {
      setDraftSightings(draftSightings.filter((s) => s.tempId !== tempId));
    }
  };

  const updateSighting = (tempId: string, field: keyof DraftSighting, value: any) => {
    // Check if this is the last row BEFORE updating
    const isLastRow = draftSightings[draftSightings.length - 1].tempId === tempId;
    const shouldAutoAdd = field === 'species_id' && value !== null && isLastRow;

    // Update the sighting
    const updatedSightings = draftSightings.map((s) =>
      s.tempId === tempId ? { ...s, [field]: value } : s
    );

    // If we should auto-add, add the new row immediately
    if (shouldAutoAdd) {
      setDraftSightings([
        ...updatedSightings,
        {
          tempId: `temp-${Date.now()}`,
          species_id: null,
          count: 1,
        },
      ]);
    } else {
      setDraftSightings(updatedSightings);
    }

    // Clear sightings validation error when user starts adding sightings
    if (validationErrors.sightings) {
      setValidationErrors({ ...validationErrors, sightings: undefined });
    }
  };


  // ============================================================================
  // Form Submission
  // ============================================================================

  const handleSave = async () => {
    // Validate survey fields
    if (!validate()) {
      setError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Step 1: Create survey
      const surveyData: Partial<Survey> = {
        date: date!.format('YYYY-MM-DD'),
        location_id: locationId!,
        surveyor_ids: selectedSurveyors.map((s) => s.id),
        type: 'butterfly', // Default type
        notes: notes.trim() || null,
      };

      const newSurvey = await surveysAPI.create(surveyData);

      // Step 2: Add sightings
      const validSightings = draftSightings.filter(
        (s) => s.species_id !== null && s.count > 0
      );

      await Promise.all(
        validSightings.map((sighting) =>
          surveysAPI.addSighting(newSurvey.id, {
            species_id: sighting.species_id!,
            count: sighting.count,
          })
        )
      );

      // Success - navigate back to surveys list with created parameter
      navigate(`/surveys?created=${newSurvey.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create survey');
      console.error('Error creating survey:', err);
      setSaving(false);
    }
  };

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleCancel = () => {
    navigate('/surveys');
  };

  const handleBack = () => {
    navigate('/surveys');
  };

  // ============================================================================
  // Loading State
  // ============================================================================

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: 4 }}>
        {/* Breadcrumb Navigation */}
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            component="button"
            onClick={handleBack}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              textDecoration: 'none',
              color: 'text.secondary',
              cursor: 'pointer',
              '&:hover': { color: 'primary.main' },
            }}
          >
            <ArrowBack sx={{ fontSize: 18 }} />
            Surveys
          </Link>
          <Typography color="text.primary">New Survey</Typography>
        </Breadcrumbs>

        {/* Page Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
          <Typography
            variant="h1"
            sx={{
              fontSize: '2.5rem',
              fontWeight: 700,
              color: 'text.primary',
            }}
          >
            New Survey
          </Typography>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<Cancel />}
              onClick={handleCancel}
              disabled={saving}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: 'none',
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={saving ? undefined : <Save />}
              onClick={handleSave}
              disabled={
                saving ||
                !date ||
                !locationId ||
                selectedSurveyors.length === 0 ||
                draftSightings.filter((s) => s.species_id !== null && s.count > 0).length === 0
              }
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
                minWidth: 140,
              }}
            >
              {saving ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Saving...
                </>
              ) : (
                'Save Survey'
              )}
            </Button>
          </Stack>
        </Stack>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Survey Details Card */}
        <Paper
          sx={{
            p: 3,
            mb: 3,
            boxShadow: 'none',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Survey Details
          </Typography>

          <Stack spacing={3}>
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
                },
              }}
            />

            {/* Location Dropdown */}
            <Autocomplete
              options={locations}
              getOptionLabel={(option) => option.name}
              value={locations.find((l) => l.id === locationId) || null}
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
              getOptionLabel={(option) => `${option.first_name} ${option.last_name}`}
              value={selectedSurveyors}
              open={surveyorsOpen}
              onOpen={() => setSurveyorsOpen(true)}
              onClose={(_event, reason) => {
                // Only close when clicking outside or pressing escape, not when selecting
                if (reason !== 'selectOption') {
                  setSurveyorsOpen(false);
                }
              }}
              onChange={(_, newValue) => setSelectedSurveyors(newValue)}
              disableCloseOnSelect
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Surveyors *"
                  error={!!validationErrors.surveyors}
                  helperText={validationErrors.surveyors}
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={`${option.first_name} ${option.last_name}`}
                    {...getTagProps({ index })}
                    size="small"
                  />
                ))
              }
            />

            {/* Notes */}
            <TextField
              label="Notes (Optional)"
              multiline
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes about this survey..."
              fullWidth
            />
          </Stack>
        </Paper>

        {/* Sightings Card */}
        <Paper
          sx={{
            p: 3,
            boxShadow: 'none',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Sightings ({draftSightings.filter((s) => s.species_id !== null).length})
          </Typography>

          {/* Validation Error */}
          {validationErrors.sightings && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {validationErrors.sightings}
            </Alert>
          )}

          {/* Sightings Table */}
          {draftSightings.length > 0 ? (
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              {/* Table Header */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '3fr 1fr 60px',
                  gap: 2,
                  p: 1.5,
                  bgcolor: 'grey.50',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="body2" fontWeight={600} color="text.secondary">
                  SPECIES *
                </Typography>
                <Typography variant="body2" fontWeight={600} color="text.secondary">
                  COUNT *
                </Typography>
                <Typography variant="body2" fontWeight={600} color="text.secondary" textAlign="center">
                  ACTIONS
                </Typography>
              </Box>

              {/* Table Rows */}
              {draftSightings.map((sighting, index) => {
                const isLastRow = index === draftSightings.length - 1;
                const isEmpty = sighting.species_id === null;
                const isEmptyLastRow = isLastRow && isEmpty;

                return (
                  <Box
                    key={sighting.tempId}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '3fr 1fr 60px',
                      gap: 2,
                      p: 1.5,
                      borderBottom: index < draftSightings.length - 1 ? '1px solid' : 'none',
                      borderColor: 'divider',
                      alignItems: 'center',
                      // Subtle styling for the empty last row
                      bgcolor: isEmptyLastRow ? 'grey.50' : 'transparent',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    {/* Species Dropdown */}
                    <Autocomplete
                      options={species}
                      getOptionLabel={(option) => option.name}
                      value={species.find((s) => s.id === sighting.species_id) || null}
                      onChange={(_, newValue) =>
                        updateSighting(sighting.tempId, 'species_id', newValue?.id || null)
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder={isEmptyLastRow ? 'Start typing to add sighting...' : 'Select species'}
                          size="small"
                        />
                      )}
                      size="small"
                    />

                    {/* Count Input */}
                    <TextField
                      type="number"
                      value={sighting.count}
                      onChange={(e) =>
                        updateSighting(sighting.tempId, 'count', Math.max(1, parseInt(e.target.value) || 1))
                      }
                      onKeyDown={(e) => {
                        // Press Enter to add new row and focus next species field
                        if (e.key === 'Enter' && sighting.species_id !== null) {
                          e.preventDefault();
                          addSightingRow();
                          // Focus will naturally move to next row after state update
                        }
                        // Press Tab on last field to move to next row's species
                        if (e.key === 'Tab' && !e.shiftKey && isLastRow && sighting.species_id !== null) {
                          // Default Tab behavior will work, but ensure we have a new row
                          if (isEmpty) {
                            addSightingRow();
                          }
                        }
                      }}
                      size="small"
                      inputProps={{ min: 1 }}
                      placeholder="#"
                    />

                    {/* Delete Button */}
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => removeSightingRow(sighting.tempId)}
                      disabled={draftSightings.length === 1}
                      sx={{
                        justifySelf: 'center',
                        opacity: isEmptyLastRow ? 0.3 : 1,
                      }}
                    >
                      <Delete sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                );
              })}
            </Box>
          ) : null}
        </Paper>
      </Box>
    </LocalizationProvider>
  );
}
